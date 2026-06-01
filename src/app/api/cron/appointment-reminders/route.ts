/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cron diário: lembrete WhatsApp 24h antes do agendamento.
 * Janela: agendamentos com scheduledAt entre 23h e 25h à frente.
 * Marca reminderSentAt pra não duplicar.
 *
 * Chamada externa: GET /api/cron/appointment-reminders?key=SEU_CRON_SECRET
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionSendText, EvolutionInvalidNumberError } from "@/lib/evolution";
import { formatBRShort } from "@/lib/appointments";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 3600_000);
  const windowEnd = new Date(now.getTime() + 25 * 3600_000);

  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
    },
    include: {
      lead: { select: { id: true, name: true, phone: true, followUpOptOut: true } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const a of due) {
    if (a.lead.followUpOptOut) {
      skipped++;
      await prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
      continue;
    }
    const firstName = (a.lead.name?.split(" ")[0] ?? "tudo bem").trim();
    const text =
      `Oi ${firstName}! Aqui é o Luma da Pneu Zero 🛞\n` +
      `Só passando pra lembrar do seu *${a.serviceName}* marcado pra amanhã às *${formatBRShort(a.scheduledAt)}*. ` +
      `Está confirmado? Se precisar remarcar, é só me avisar por aqui.`;

    try {
      await evolutionSendText({ number: a.lead.phone, text });
      await prisma.appointment.update({
        where: { id: a.id },
        data: { reminderSentAt: now },
      });
      sent++;
    } catch (err) {
      if (err instanceof EvolutionInvalidNumberError) {
        skipped++;
        await prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${a.id}: ${msg}`);
      }
    }
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent, skipped, errors });
}
