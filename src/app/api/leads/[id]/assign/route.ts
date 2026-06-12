/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Atribui (POST) ou libera (DELETE) um lead da fila de atendimento.
 * POST → assignedUserId = session.user.id (vendedor que está assumindo).
 * DELETE → assignedUserId = null (libera de volta pra fila).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postBotToGeneral } from "@/lib/team-bot";
import { publishNotif } from "@/lib/notifications-bus";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadLead(id: string, organizationId: string) {
  return prisma.lead.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      name: true,
      phone: true,
      assignedUserId: true,
      assignedUser: { select: { id: true, name: true, avatar: true } },
    },
  });
}

export async function POST(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await ctx.params;

  const lead = await loadLead(id, session.user.organizationId);
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  // Já assumido por outro? Bloqueia mas devolve quem é
  if (lead.assignedUserId && lead.assignedUserId !== session.user.id) {
    return NextResponse.json({
      ok: false,
      conflict: true,
      assignedUser: lead.assignedUser,
      message: `Conversa já está com ${lead.assignedUser?.name ?? "outro vendedor"}.`,
    }, { status: 409 });
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      assignedUserId: session.user.id,
      assignedAt: new Date(),
      ownerType: "human",
      status: "EM_ATENDIMENTO",
    },
    select: {
      id: true,
      assignedUserId: true,
      assignedUser: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Fecha handoffs abertos desse lead (já tem dono agora)
  await prisma.handoff.updateMany({
    where: { leadId: id, status: "open" },
    data: { status: "assigned", assignedToId: session.user.id },
  });

  const clienteNome = lead.name || lead.phone;
  void postBotToGeneral(
    session.user.organizationId,
    `🙋 *${session.user.name}* assumiu o atendimento de *${clienteNome}*.`
  );
  publishNotif({
    organizationId: session.user.organizationId,
    kind: "handoff",
    title: `Assumido: ${clienteNome}`,
    body: `${session.user.name} pegou esta conversa.`,
    url: `/chats/${id}`,
  });

  return NextResponse.json({ ok: true, lead: updated });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await ctx.params;

  const lead = await loadLead(id, session.user.organizationId);
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  // Só quem assumiu pode liberar (ou admin via session.role — simplifica: qualquer um por enquanto)
  await prisma.lead.update({
    where: { id },
    data: { assignedUserId: null, assignedAt: null },
  });

  const clienteNome = lead.name || lead.phone;
  void postBotToGeneral(
    session.user.organizationId,
    `↩️ *${clienteNome}* voltou para a fila (liberado por ${session.user.name}).`
  );

  return NextResponse.json({ ok: true });
}
