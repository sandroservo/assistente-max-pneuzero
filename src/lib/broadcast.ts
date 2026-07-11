/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Disparo em massa persistente + anti-ban.
 * O job vive no banco (Broadcast/BroadcastRecipient); um worker in-process
 * (iniciado por instrumentation.ts) processa cada destinatário no seu
 * scheduledAt. Sobrevive a fechar o navegador e retoma após restart do
 * serviço, pois o estado está todo no Postgres.
 */

import { prisma } from "./prisma";
import {
  evolutionSendTextHumanized,
  evolutionSendMedia,
  evolutionSendPresence,
  EvolutionInvalidNumberError,
} from "./evolution";

export interface CreateBroadcastContact {
  phone: string;
  name: string;
}

/**
 * Expande spintax `{a|b|c}` escolhendo opção aleatória (resolve de dentro pra
 * fora, suporta aninhamento). Grupos sem `|` ficam intactos — `{nome}` não é
 * consumido aqui.
 */
export function expandSpintax(text: string): string {
  const re = /\{([^{}]*\|[^{}]*)\}/;
  let out = text;
  let guard = 0;
  while (re.test(out) && guard++ < 100) {
    out = out.replace(re, (_, group: string) => {
      const opts = group.split("|");
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }
  return out;
}

/** {nome}/{name} → primeiro nome. Roda ANTES do spintax. */
export function personalize(text: string, name: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  return text.replace(/\{nome\}|\{name\}/gi, first);
}

/** Gap grande e imprevisível entre envios (anti-ban). */
function randomGapMs(minSec: number, maxSec: number, index: number): number {
  const minMs = Math.max(15, minSec) * 1000;
  const maxMs = Math.max(minMs, maxSec * 1000);
  const base = minMs + Math.random() * (maxMs - minMs);
  // A cada ~5 envios, 30% de chance de pausa longa (60-180s) — "distração".
  const extra =
    index > 0 && index % 5 === 0 && Math.random() < 0.3
      ? 60000 + Math.random() * 120000
      : 0;
  return Math.round(base + extra);
}

/**
 * Cria o job: embaralha contatos e agenda cada um com gaps cumulativos.
 * scheduledAt absoluto "congela" o espaçamento — o tick nunca envia antes.
 */
export async function createBroadcast(opts: {
  contacts: CreateBroadcastContact[];
  message: string;
  imageBase64?: string;
  imageMime?: string;
  minDelaySec: number;
  maxDelaySec: number;
  createdById?: string;
}): Promise<{ id: string; total: number }> {
  const shuffled = [...opts.contacts].sort(() => Math.random() - 0.5);

  // Primeiro envio começa em ~3-8s; demais somam gaps aleatórios.
  let cursor = Date.now() + 3000 + Math.random() * 5000;
  const recipients = shuffled.map((c, i) => {
    if (i > 0) cursor += randomGapMs(opts.minDelaySec, opts.maxDelaySec, i);
    return {
      phone: c.phone,
      name: c.name || c.phone,
      scheduledAt: new Date(cursor),
    };
  });

  const broadcast = await prisma.broadcast.create({
    data: {
      message: opts.message,
      imageBase64: opts.imageBase64 || null,
      imageMime: opts.imageMime || null,
      minDelaySec: Math.max(15, opts.minDelaySec),
      maxDelaySec: Math.max(Math.max(15, opts.minDelaySec), opts.maxDelaySec),
      total: recipients.length,
      status: "RUNNING",
      createdById: opts.createdById || null,
      recipients: { create: recipients },
    },
    select: { id: true, total: true },
  });

  return broadcast;
}

// Trava em memória contra ticks sobrepostos (1 processo systemd).
let ticking = false;

/**
 * Processa 1 destinatário devido por broadcast RUNNING. Chamado periodicamente
 * pelo worker. Idempotente: claim atômico (QUEUED→SENDING) evita envio duplo.
 */
export async function tickBroadcasts(): Promise<{ processed: number }> {
  if (ticking) return { processed: 0 };
  ticking = true;
  let processed = 0;
  try {
    const running = await prisma.broadcast.findMany({
      where: { status: "RUNNING" },
      select: { id: true, message: true, imageBase64: true, imageMime: true },
    });

    for (const bc of running) {
      const due = await prisma.broadcastRecipient.findFirst({
        where: { broadcastId: bc.id, status: "QUEUED", scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        select: { id: true, phone: true, name: true },
      });

      if (!due) {
        // Sem devidos: se não há mais QUEUED, o job acabou.
        const pending = await prisma.broadcastRecipient.count({
          where: { broadcastId: bc.id, status: { in: ["QUEUED", "SENDING"] } },
        });
        if (pending === 0) {
          await prisma.broadcast.update({ where: { id: bc.id }, data: { status: "DONE" } });
        }
        continue;
      }

      // Claim atômico: só um tick vence a corrida.
      const claim = await prisma.broadcastRecipient.updateMany({
        where: { id: due.id, status: "QUEUED" },
        data: { status: "SENDING" },
      });
      if (claim.count === 0) continue;

      try {
        const finalText = expandSpintax(personalize(bc.message, due.name));
        if (bc.imageBase64) {
          await evolutionSendPresence(due.phone, "composing");
          await sleep(1500 + Math.random() * 2000);
          await evolutionSendMedia({
            number: due.phone,
            mediatype: "image",
            media: bc.imageBase64,
            mimetype: bc.imageMime || "image/jpeg",
            caption: finalText,
          });
        } else {
          await evolutionSendTextHumanized({ number: due.phone, text: finalText });
        }
        await prisma.broadcastRecipient.update({
          where: { id: due.id },
          data: { status: "SENT", sentAt: new Date() },
        });
        await prisma.broadcast.update({ where: { id: bc.id }, data: { sent: { increment: 1 } } });
        processed++;
      } catch (err) {
        const msg =
          err instanceof EvolutionInvalidNumberError
            ? "número sem WhatsApp"
            : err instanceof Error
              ? err.message
              : "erro desconhecido";
        await prisma.broadcastRecipient.update({
          where: { id: due.id },
          data: { status: "FAILED", error: msg.slice(0, 300) },
        });
        await prisma.broadcast.update({ where: { id: bc.id }, data: { failed: { increment: 1 } } });
        processed++;
      }
    }
  } finally {
    ticking = false;
  }
  return { processed };
}

let workerStarted = false;

/**
 * Inicia o loop do worker (uma vez por processo). Idempotente.
 * Também "destrava" destinatários SENDING órfãos de um restart no meio do envio.
 */
export function startBroadcastWorker(intervalMs = 20000): void {
  if (workerStarted) return;
  workerStarted = true;

  // Recupera SENDING pendurados (processo caiu entre claim e update).
  prisma.broadcastRecipient
    .updateMany({ where: { status: "SENDING" }, data: { status: "QUEUED" } })
    .catch(() => {});

  const loop = () => {
    tickBroadcasts()
      .catch((e) => console.error("[broadcast] tick error:", e))
      // unref: o timer não segura o event loop → serviço reinicia limpo (sem
      // esperar SIGTERM estourar em 90s). Um envio em andamento termina antes.
      .finally(() => setTimeout(loop, intervalMs).unref());
  };
  setTimeout(loop, intervalMs).unref();
  console.log("[broadcast] worker iniciado");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
