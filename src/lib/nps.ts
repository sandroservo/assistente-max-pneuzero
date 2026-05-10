/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Parser e gestão de respostas NPS (pesquisa pós-venda).
 */

import { prisma } from "./prisma";

export function extractNPSScore(text: string): number | null {
  const t = text.trim();
  // só responde NPS se mensagem for predominantemente uma nota
  if (t.length > 50) return null;
  const m = t.match(/\b(10|[0-9])\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n < 0 || n > 10) return null;
  return n;
}

export function categorizarNPS(nota: number): "detrator" | "neutro" | "promotor" {
  if (nota <= 6) return "detrator";
  if (nota <= 8) return "neutro";
  return "promotor";
}

/**
 * Verifica se há FollowUp NPS recente aguardando resposta deste lead.
 * Retorna a Sale relacionada (para vincular NPSResponse) ou null.
 */
export async function findPendingNPS(leadId: string) {
  const recentFollowUp = await prisma.followUp.findFirst({
    where: {
      leadId,
      type: "nps_d1",
      status: "sent",
      sentAt: { gte: new Date(Date.now() - 7 * 86400000) }, // últimos 7 dias
    },
    orderBy: { sentAt: "desc" },
  });
  if (!recentFollowUp?.saleId) return null;

  const existingResp = await prisma.nPSResponse.findUnique({
    where: { saleId: recentFollowUp.saleId },
  });
  if (existingResp) return null;

  return recentFollowUp;
}

/**
 * Registra resposta NPS. Se detrator, cria handoff automático.
 */
export async function recordNPSResponse(opts: {
  leadId: string;
  saleId: string;
  conversationId: string;
  nota: number;
  comentario?: string;
}) {
  const categoria = categorizarNPS(opts.nota);

  const resp = await prisma.nPSResponse.create({
    data: {
      saleId: opts.saleId,
      leadId: opts.leadId,
      nota: opts.nota,
      categoria,
      comentario: opts.comentario,
    },
  });

  if (categoria === "detrator") {
    const open = await prisma.handoff.findFirst({
      where: { conversationId: opts.conversationId, status: "open" },
    });
    if (!open) {
      await prisma.handoff.create({
        data: {
          leadId: opts.leadId,
          conversationId: opts.conversationId,
          requestedBy: "bot",
          reason: `NPS detrator (nota ${opts.nota})`,
          summary: opts.comentario ?? null,
          status: "open",
        },
      });
      await prisma.lead.update({
        where: { id: opts.leadId },
        data: { status: "HUMANO_SOLICITADO" },
      });
    }
  }

  return resp;
}

export function npsReplyMessage(categoria: "detrator" | "neutro" | "promotor"): string {
  switch (categoria) {
    case "promotor":
      return "Que bom saber, muito obrigado pelo carinho! 🙏 Se puder, deixa pra gente uma avaliação no Google: ajuda demais. Conta com a gente sempre! 🚗";
    case "neutro":
      return "Valeu pela nota! Tem algum ponto que poderíamos melhorar? Sua opinião ajuda a gente a evoluir 🙂";
    case "detrator":
      return "Poxa, obrigado pela sinceridade. Vou pedir pra alguém da equipe te chamar pra entender direitinho o que aconteceu e resolver. Pode me contar mais?";
  }
}
