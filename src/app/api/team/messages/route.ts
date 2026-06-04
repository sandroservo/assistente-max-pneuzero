/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Chat interno: histórico (GET) e envio (POST) de mensagens.
 * channel=global ou channel=dm&peer=<userId>.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teamBus } from "@/lib/team-bus";
import { postBotToGeneral } from "@/lib/team-bot";
import {
  canonicalDmKey,
  sanitizeBody,
} from "@/lib/team-chat";
import { handleTeamAppointmentCommand } from "@/lib/team-appointment-commands";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const peer = searchParams.get("peer");
  const beforeId = searchParams.get("before"); // paginação opcional (id)
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  if (channel !== "global" && channel !== "dm") {
    return NextResponse.json({ error: "channel inválido" }, { status: 400 });
  }

  let dmKey: string | null = null;
  if (channel === "dm") {
    if (!peer || peer === session.user.id) {
      return NextResponse.json({ error: "peer inválido" }, { status: 400 });
    }
    // Confirma que peer está na mesma org
    const peerUser = await prisma.user.findFirst({
      where: { id: peer, organizationId: session.user.organizationId },
      select: { id: true },
    });
    if (!peerUser) {
      return NextResponse.json({ error: "peer não encontrado" }, { status: 404 });
    }
    dmKey = canonicalDmKey(session.user.id, peer);
  }

  const cursor = beforeId
    ? await prisma.teamMessage.findUnique({
        where: { id: beforeId },
        select: { createdAt: true },
      })
    : null;

  const messages = await prisma.teamMessage.findMany({
    where: {
      organizationId: session.user.organizationId,
      dmKey,
      ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Devolve em ordem cronológica crescente
  const ordered = messages.reverse().map((m) => ({
    id: m.id,
    authorId: m.authorId,
    authorName: m.author.name,
    authorAvatar: m.author.avatar,
    dmKey: m.dmKey,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({ messages: ordered, hasMore: messages.length === limit });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const channel = body?.channel as string | undefined;
  const peer = body?.peer as string | undefined;
  const text = sanitizeBody(body?.body);

  if (!text) {
    return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });
  }
  if (channel !== "global" && channel !== "dm") {
    return NextResponse.json({ error: "channel inválido" }, { status: 400 });
  }

  let dmKey: string | null = null;
  if (channel === "dm") {
    if (!peer || peer === session.user.id) {
      return NextResponse.json({ error: "peer inválido" }, { status: 400 });
    }
    const peerUser = await prisma.user.findFirst({
      where: { id: peer, organizationId: session.user.organizationId },
      select: { id: true },
    });
    if (!peerUser) {
      return NextResponse.json({ error: "peer não encontrado" }, { status: 404 });
    }
    dmKey = canonicalDmKey(session.user.id, peer);
  }

  const created = await prisma.teamMessage.create({
    data: {
      organizationId: session.user.organizationId,
      authorId: session.user.id,
      dmKey,
      body: text,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });

  const payload = {
    id: created.id,
    authorId: created.authorId,
    authorName: created.author.name,
    authorAvatar: created.author.avatar,
    dmKey: created.dmKey,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  };

  teamBus.publish({
    type: "message",
    organizationId: session.user.organizationId,
    message: payload,
  });

  let commandResult: Awaited<ReturnType<typeof handleTeamAppointmentCommand>> | null = null;
  if (channel === "global") {
    try {
      commandResult = await handleTeamAppointmentCommand({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        text,
      });

      if (commandResult.handled && commandResult.message) {
        const prefix = commandResult.ok ? "✅" : "⚠️";
        await postBotToGeneral(session.user.organizationId, `${prefix} ${commandResult.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      commandResult = {
        handled: true,
        ok: false,
        message: msg,
      };
      await postBotToGeneral(
        session.user.organizationId,
        `⚠️ Não consegui resolver esse comando de agendamento: ${msg}`
      );
    }
  }

  return NextResponse.json({ message: payload, commandResult });
}
