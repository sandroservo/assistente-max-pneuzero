/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Disparo em massa PERSISTENTE. POST cria o job no banco e retorna jobId
 * na hora; o worker in-process (lib/broadcast + instrumentation) envia em
 * background com espaçamento anti-ban. Sobrevive a fechar o navegador.
 * GET lista o job ativo / status para o painel fazer polling.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBroadcast } from "@/lib/broadcast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BroadcastContact {
  phone: string;
  name: string;
}

interface BroadcastPayload {
  contacts: BroadcastContact[];
  message: string;
  imageBase64?: string;
  imageMimeType?: string;
  minDelaySec?: number;
  maxDelaySec?: number;
}

export async function POST(req: Request) {
  try {
    const body: BroadcastPayload = await req.json();
    const { contacts, message, imageBase64, imageMimeType } = body;

    if (!contacts?.length || !message?.trim()) {
      return NextResponse.json(
        { error: "Contatos e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    const minDelaySec = Math.max(15, body.minDelaySec ?? 45);
    const maxDelaySec = Math.max(minDelaySec, body.maxDelaySec ?? 120);

    const job = await createBroadcast({
      contacts,
      message,
      imageBase64,
      imageMime: imageMimeType,
      minDelaySec,
      maxDelaySec,
    });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      total: job.total,
      message: `Disparo criado para ${job.total} contatos. Roda em background — pode fechar a aba.`,
    });
  } catch (error) {
    console.error("[Broadcast] Erro ao criar job:", error);
    return NextResponse.json({ error: "Erro interno no broadcast" }, { status: 500 });
  }
}

/**
 * GET /api/broadcast          → job ativo mais recente (RUNNING) + progresso
 * GET /api/broadcast?id=xxx   → status de um job específico
 */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");

    const broadcast = id
      ? await prisma.broadcast.findUnique({ where: { id } })
      : await prisma.broadcast.findFirst({
          where: { status: "RUNNING" },
          orderBy: { createdAt: "desc" },
        });

    if (!broadcast) {
      return NextResponse.json({ active: false });
    }

    // Próximo envio agendado (pra UI mostrar "próximo em Xs")
    const next = await prisma.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast.id, status: "QUEUED" },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    });

    // Últimos processados (feed do painel)
    const recent = await prisma.broadcastRecipient.findMany({
      where: { broadcastId: broadcast.id, status: { in: ["SENT", "FAILED"] } },
      orderBy: { sentAt: "desc" },
      take: 15,
      select: { name: true, phone: true, status: true, error: true },
    });

    return NextResponse.json({
      active: broadcast.status === "RUNNING",
      id: broadcast.id,
      status: broadcast.status,
      total: broadcast.total,
      sent: broadcast.sent,
      failed: broadcast.failed,
      nextAt: next?.scheduledAt ?? null,
      recent,
    });
  } catch (error) {
    console.error("[Broadcast] Erro no GET:", error);
    return NextResponse.json({ error: "Erro ao consultar status" }, { status: 500 });
  }
}

/** DELETE /api/broadcast?id=xxx → cancela o job (para envios futuros). */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    await prisma.broadcast.update({
      where: { id },
      data: { status: "CANCELED" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Broadcast] Erro ao cancelar:", error);
    return NextResponse.json({ error: "Erro ao cancelar" }, { status: 500 });
  }
}
