/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * GET sumário rolante da conversa do lead. Single-tenant: 1 conversation por lead.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const conv = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      summary: true,
      summaryUpdatedAt: true,
      messagesSinceSummary: true,
      lastMessageAt: true,
    },
  });

  if (!conv) {
    return NextResponse.json({ summary: null, messagesSinceSummary: 0, summaryUpdatedAt: null, lastMessageAt: null });
  }

  return NextResponse.json({
    summary: conv.summary,
    summaryUpdatedAt: conv.summaryUpdatedAt,
    messagesSinceSummary: conv.messagesSinceSummary,
    lastMessageAt: conv.lastMessageAt,
  });
}
