/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * REST de agendamentos. GET lista (filtros: from, to, status, leadId, q).
 * POST cria manualmente (pelo painel — atribui createdById).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAppointment, formatBR } from "@/lib/appointments";
import { postBotToGeneral } from "@/lib/team-bot";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const leadId = searchParams.get("leadId");
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const where: Record<string, unknown> = { organizationId: session.user.organizationId };
  if (from || to) {
    where.scheduledAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (status) where.status = status;
  if (leadId) where.leadId = leadId;
  if (q) {
    where.OR = [
      { serviceName: { contains: q, mode: "insensitive" } },
      { lead: { name: { contains: q, mode: "insensitive" } } },
      { lead: { phone: { contains: q } } },
    ];
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    take: limit,
    include: {
      lead: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      vehicle: { select: { id: true, marca: true, modelo: true, ano: true, placa: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ appointments });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { leadId, serviceName, scheduledAt, vehicleId, serviceItemId, notes } = body ?? {};

  if (!leadId || !serviceName || !scheduledAt) {
    return NextResponse.json(
      { error: "Campos obrigatórios: leadId, serviceName, scheduledAt" },
      { status: 400 }
    );
  }

  const date = new Date(scheduledAt);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "scheduledAt inválido" }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    select: { id: true, name: true, phone: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const appt = await createAppointment({
    organizationId: session.user.organizationId,
    leadId,
    serviceName,
    scheduledAt: date,
    vehicleId: vehicleId || undefined,
    serviceItemId: serviceItemId || undefined,
    notes: notes || undefined,
    source: "user",
    createdById: session.user.id,
  });

  void postBotToGeneral(
    session.user.organizationId,
    `📋 *Agendamento manual (${session.user.name})*\n👤 ${lead.name || lead.phone}\n📞 ${lead.phone}\n🔧 ${serviceName}\n📅 ${formatBR(date)}`
  );

  return NextResponse.json({ appointment: appt });
}
