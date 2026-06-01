/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * GET lista solicitações de agendamento (filtros: status, from, to).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };
  if (status !== "all") where.status = status;

  const items = await prisma.appointmentRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
    take: limit,
    include: {
      lead: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ requests: items });
}
