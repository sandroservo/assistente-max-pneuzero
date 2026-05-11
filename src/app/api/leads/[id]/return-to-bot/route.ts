/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Endpoint para devolver lead ao atendimento do bot
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { conversations: { take: 1, orderBy: { createdAt: "desc" } } },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: "lead not found" },
        { status: 404 }
      );
    }

    await prisma.lead.update({
      where: { id },
      data: {
        ownerType: "bot",
        status: "EM_ATENDIMENTO"
      },
    });

    // Fecha handoffs em aberto/atribuídos da conversa
    if (lead.conversations[0]) {
      await prisma.handoff.updateMany({
        where: {
          conversationId: lead.conversations[0].id,
          status: { in: ["open", "assigned"] },
        },
        data: { status: "closed" },
      });
    }

    return NextResponse.json({ ok: true, message: "Lead devolvido ao bot" });
  } catch (error) {
    console.error("Return to bot error:", error);
    return NextResponse.json(
      { ok: false, error: "internal error" },
      { status: 500 }
    );
  }
}
