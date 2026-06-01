/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Wrapper Web Push + helper pra notificar todos vendedores ativos quando
 * Luma cria handoff. Usa VAPID (chaves em env VAPID_PUBLIC_KEY/PRIVATE_KEY).
 */

import webpush from "web-push";
import { prisma } from "./prisma";

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@pneuzero.cloudservo.com.br";
  if (!pub || !priv) return; // não configurado → sendPush vira no-op
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export function isWebPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // pra onde abrir ao clicar
  tag?: string; // agrupa notifs no SO
  requireInteraction?: boolean; // não some sozinho
  icon?: string;
}

/**
 * Envia push pra um único endpoint. Se 404/410 → remove do banco (subscription morta).
 */
async function sendToOne(sub: { id: string; endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<{ ok: boolean; expired?: boolean }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // 24h
    );
    return { ok: true };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      // Subscription expirou — limpa do banco
      try { await prisma.pushSubscription.delete({ where: { id: sub.id } }); } catch { /* ignore */ }
      return { ok: false, expired: true };
    }
    console.error("[web-push] sendNotification falhou:", status, err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/**
 * Envia push pra TODOS vendedores ativos da org (exceto o autor da ação, se houver).
 * Fire-and-forget — não bloqueia caller. Retorna contadores.
 */
export async function pushToActiveAgents(
  organizationId: string,
  payload: PushPayload,
  opts: { excludeUserId?: string } = {}
): Promise<{ sent: number; expired: number; total: number }> {
  configure();
  if (!isWebPushConfigured()) {
    console.warn("[web-push] não configurado (VAPID_PUBLIC_KEY/PRIVATE_KEY ausentes) — push ignorado");
    return { sent: 0, expired: 0, total: 0 };
  }

  const subs = await prisma.pushSubscription.findMany({
    where: {
      user: {
        organizationId,
        active: true,
        ...(opts.excludeUserId ? { NOT: { id: opts.excludeUserId } } : {}),
      },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subs.length === 0) return { sent: 0, expired: 0, total: 0 };

  let sent = 0;
  let expired = 0;
  const results = await Promise.allSettled(subs.map((s) => sendToOne(s, payload)));
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.ok) sent++;
      if (r.value.expired) expired++;
    }
  }
  return { sent, expired, total: subs.length };
}
