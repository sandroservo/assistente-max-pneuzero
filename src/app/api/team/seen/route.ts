/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Marca channel como lido (atualiza lastSeenAt do usuário no TeamChannelState).
 * Aceita { channel: "global" } ou { channel: "dm", peer: <userId> }.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teamBus } from "@/lib/team-bus";
import {
  canonicalDmKey,
  channelKeyForDm,
  channelKeyForGlobal,
} from "@/lib/team-chat";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const channel = body?.channel as string | undefined;
  const peer = body?.peer as string | undefined;

  let channelKey: string;
  if (channel === "global") {
    channelKey = channelKeyForGlobal();
  } else if (channel === "dm" && peer && peer !== session.user.id) {
    const peerUser = await prisma.user.findFirst({
      where: { id: peer, organizationId: session.user.organizationId },
      select: { id: true },
    });
    if (!peerUser) {
      return NextResponse.json({ error: "peer não encontrado" }, { status: 404 });
    }
    channelKey = channelKeyForDm(canonicalDmKey(session.user.id, peer));
  } else {
    return NextResponse.json({ error: "channel inválido" }, { status: 400 });
  }

  const now = new Date();
  await prisma.teamChannelState.upsert({
    where: { userId_channelKey: { userId: session.user.id, channelKey } },
    update: { lastSeenAt: now },
    create: { userId: session.user.id, channelKey, lastSeenAt: now },
  });

  teamBus.publish({
    type: "seen",
    organizationId: session.user.organizationId,
    seen: {
      userId: session.user.id,
      channelKey,
      lastSeenAt: now.toISOString(),
    },
  });

  return NextResponse.json({ ok: true, channelKey, lastSeenAt: now.toISOString() });
}

// GET → retorna mapa { channelKey: lastSeenAt } do usuário + unread counts por canal.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const states = await prisma.teamChannelState.findMany({
    where: { userId: session.user.id },
  });
  const stateMap: Record<string, string> = {};
  for (const s of states) stateMap[s.channelKey] = s.lastSeenAt.toISOString();

  // Unread Geral: msgs criadas após lastSeenAt do canal global, exceto próprias
  const globalSeen = stateMap["global"] ? new Date(stateMap["global"]) : new Date(0);
  const unreadGlobal = await prisma.teamMessage.count({
    where: {
      organizationId: session.user.organizationId,
      dmKey: null,
      createdAt: { gt: globalSeen },
      NOT: { authorId: session.user.id },
    },
  });

  // Unread DMs: agrupar por dmKey (apenas DMs que envolvem o usuário)
  const dmMessages = await prisma.teamMessage.findMany({
    where: {
      organizationId: session.user.organizationId,
      dmKey: { not: null, contains: session.user.id },
      NOT: { authorId: session.user.id },
    },
    select: { dmKey: true, createdAt: true },
  });

  const unreadByDmKey: Record<string, number> = {};
  for (const m of dmMessages) {
    if (!m.dmKey) continue;
    const key = channelKeyForDm(m.dmKey);
    const seen = stateMap[key] ? new Date(stateMap[key]) : new Date(0);
    if (m.createdAt > seen) {
      unreadByDmKey[m.dmKey] = (unreadByDmKey[m.dmKey] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    lastSeen: stateMap,
    unread: { global: unreadGlobal, dm: unreadByDmKey },
  });
}
