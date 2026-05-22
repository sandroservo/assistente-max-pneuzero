/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * PATCH atualiza (data/serviço/status/notas) — DELETE cancela.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelAppointment } from "@/lib/appointments";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "scheduledAt inválido" }, { status: 400 });
    data.scheduledAt = d;
  }
  if (typeof body.serviceName === "string") data.serviceName = body.serviceName.trim().slice(0, 200);
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 1000);
  if (body.status && ["pending", "confirmed", "done", "cancelled", "no_show"].includes(body.status)) {
    data.status = body.status;
  }

  const updated = await prisma.appointment.update({ where: { id }, data });
  return NextResponse.json({ appointment: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const url = new URL(req.url);
  const reason = url.searchParams.get("reason") ?? undefined;
  await cancelAppointment(id, reason);
  return NextResponse.json({ ok: true });
}
