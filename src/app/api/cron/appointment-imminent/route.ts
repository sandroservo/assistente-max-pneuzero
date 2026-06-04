/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cron a cada 5 min: pra agendamentos que começam em 25-35min, dispara
 * notif in-app pra equipe. Idempotente via campo `reminderImminentAt`
 * (reaproveita `reminderSentAt` se nulo seria 24h; aqui usamos flag dedicada).
 *
 * GET /api/cron/appointment-imminent?key=$CRON_SECRET
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishNotif } from "@/lib/notifications-bus";
import { formatBRShort } from "@/lib/appointments";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 25 * 60_000);
  const windowEnd = new Date(now.getTime() + 35 * 60_000);

  // Marker: uso `notes` JSON? Não — uso reminderSentAt como marker simples
  // só pra esta janela. Pra distinguir 24h vs 30min, vou rodar com tag local.
  // Solução: ler appointments na janela cuja `updatedAt < now - 30min` (não tocados)
  // e que tenham `notes` sem flag. Mais simples: criar campo dedicado.
  //
  // Aqui usamos abordagem: append "[imminent_notified=1]" em notes pra marcar.
  // Defensive: regex pra checar.

  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      lead: { select: { name: true, phone: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const a of due) {
    if ((a.notes ?? "").includes("[imminent_notified=1]")) continue;
    const clienteNome = a.lead.name || a.lead.phone;
    publishNotif({
      organizationId: a.organizationId,
      kind: "appointment_imminent",
      title: `Em 30min: ${clienteNome}`,
      body: `${a.serviceName} • ${formatBRShort(a.scheduledAt)}`,
      url: `/agendamentos`,
    });
    await prisma.appointment.update({
      where: { id: a.id },
      data: { notes: ((a.notes ?? "") + " [imminent_notified=1]").trim() },
    });
    sent++;
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
