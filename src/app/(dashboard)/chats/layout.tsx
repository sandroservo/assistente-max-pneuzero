/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Layout do Chats — estrutura WhatsApp-like com sidebar de conversas persistente
 */

import { prisma } from "@/lib/prisma";
import ConversationSidebar from "./ui/ConversationSidebar";

export const dynamic = "force-dynamic";

export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const convos = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      lead: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, type: true, direction: true },
      },
      handoffs: {
        where: { status: { in: ["open", "assigned"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          assignedTo: { select: { id: true, name: true, avatar: true } },
        },
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
    (a, b) =>
      (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
  );

  const conversations = uniqueConvos.map((c) => {
    const lastMsg = (c as any).messages?.[0] ?? null;
    const activeHandoff = (c as any).handoffs?.[0] ?? null;
    const assignedAgent = activeHandoff?.assignedTo
      ? {
          id: activeHandoff.assignedTo.id as string,
          name: activeHandoff.assignedTo.name as string,
          avatar: (activeHandoff.assignedTo.avatar ?? null) as string | null,
        }
      : null;
    return {
      id: c.id,
      leadId: c.leadId,
      name: c.lead.name,
      pushName: c.lead.pushName,
      avatarUrl: c.lead.avatarUrl,
      phone: c.lead.phone,
      status: c.lead.status as string,
      ownerType: c.lead.ownerType as string,
      leadScore: (c.lead as any).leadScore ?? 0,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessageBody: lastMsg?.body ?? null,
      lastMessageType: lastMsg?.type ?? "text",
      lastMessageDirection: lastMsg?.direction ?? "in",
      assignedAgent,
    };
  });

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationSidebar initialConversations={conversations} />
      <div className="flex-1 min-w-0 h-full">{children}</div>
    </div>
  );
}
