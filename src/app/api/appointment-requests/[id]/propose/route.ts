/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Vendedor propõe a melhor data/hora; a Luma manda pro cliente pedindo
 * confirmação. Só vira Appointment quando o cliente confirmar.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proposeAppointmentTime } from "@/lib/appointment-requests";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.appointmentRequest.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const proposedAt = body?.proposedAt ? new Date(body.proposedAt) : null;
  if (!proposedAt || isNaN(proposedAt.getTime())) {
    return NextResponse.json({ error: "Data/hora inválida" }, { status: 400 });
  }
  if (proposedAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "Data/hora no passado" }, { status: 400 });
  }

  try {
    const result = await proposeAppointmentTime(id, {
      resolvedById: session.user.id,
      proposedAt,
      note: typeof body?.note === "string" ? body.note : undefined,
    });
    return NextResponse.json({ ok: true, request: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
