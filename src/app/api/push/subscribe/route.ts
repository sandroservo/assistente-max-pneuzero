/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Salva subscription Web Push do user. Idempotente via unique(endpoint).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as SubscribeBody | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const authKey = body?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "endpoint/keys obrigatórios" }, { status: 400 });
  }

  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: session.user.id,
      p256dh,
      auth: authKey,
      userAgent: body?.userAgent?.slice(0, 500) ?? null,
    },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent: body?.userAgent?.slice(0, 500) ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
