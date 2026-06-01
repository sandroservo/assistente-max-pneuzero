/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Endpoint de teste — dispara push pro próprio user logado pra confirmar setup.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushToActiveAgents, isWebPushConfigured } from "@/lib/web-push";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "VAPID não configurado no servidor" }, { status: 503 });
  }

  const myCount = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  if (myCount === 0) {
    return NextResponse.json({ error: "Você ainda não tem subscription ativa" }, { status: 400 });
  }

  // Envia só pro user que clicou (passamos excludeUserId pra ninguém + active filter dos outros)
  // mais simples: força query do próprio
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });
  let sent = 0;
  for (const s of subs) {
    try {
      const webpush = (await import("web-push")).default;
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? "mailto:noreply@pneuzero.cloudservo.com.br",
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: "🔔 Notificação de teste",
          body: "Web Push funcionando! Você vai receber alertas quando a Luma passar um cliente pra equipe.",
          url: "/equipe",
          tag: "test",
        })
      );
      sent++;
    } catch (e) {
      console.error("[push test] falhou:", e);
    }
  }

  // Mantém pushToActiveAgents importado pra evitar dead-code (e habilita uso externo)
  void pushToActiveAgents;

  return NextResponse.json({ ok: true, sent, total: subs.length });
}
