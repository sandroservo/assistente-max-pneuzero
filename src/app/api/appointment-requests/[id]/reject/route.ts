/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rejectAppointmentRequest } from "@/lib/appointment-requests";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.appointmentRequest.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!note) {
    return NextResponse.json({ error: "Motivo (note) é obrigatório" }, { status: 400 });
  }

  try {
    const result = await rejectAppointmentRequest(id, {
      resolvedById: session.user.id,
      note,
      alternativaTexto: typeof body?.alternativaTexto === "string" ? body.alternativaTexto : undefined,
    });
    return NextResponse.json({ ok: true, request: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
