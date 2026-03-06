/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para listar conversas
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const convos = await prisma.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: {
        lead: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, type: true, direction: true },
        },
      },
      take: 200,
    });

    // Uma conversa por lead (evita duplicata)
    const byLeadId = new Map<string, (typeof convos)[number]>();
    for (const c of convos) {
      if (!byLeadId.has(c.leadId)) byLeadId.set(c.leadId, c);
    }
    const uniqueConvos = Array.from(byLeadId.values()).sort(
      (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
    );

    const conversations = uniqueConvos.map((c: (typeof uniqueConvos)[number]) => {
      const lastMsg = (c as any).messages?.[0] ?? null;
      return {
        id: c.id,
        leadId: c.leadId,
        name: c.lead.name,
        pushName: c.lead.pushName,
        avatarUrl: c.lead.avatarUrl,
        phone: c.lead.phone,
        status: c.lead.status,
        ownerType: c.lead.ownerType,
        leadScore: (c.lead as any).leadScore ?? 0,
        unreadCount: c.unreadCount,
        lastMessageAt: c.lastMessageAt,
        lastMessageBody: lastMsg?.body ?? null,
        lastMessageType: lastMsg?.type ?? "text",
        lastMessageDirection: lastMsg?.direction ?? "in",
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Erro ao buscar conversas:", error);
    return NextResponse.json({ chats: [] }, { status: 500 });
  }
}
