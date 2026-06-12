/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Cron de follow-up de silêncio. Roda a cada minuto via crontab.
 * GET /api/cron/silence-follow-up?key=$CRON_SECRET
 */

import { NextResponse } from "next/server";
import { findSilentConversations, runSilenceFollowUp } from "@/lib/silence-follow-up";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await findSilentConversations(30);
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, sent: 0, abandoned: 0 });
  }

  // Roda em paralelo limitado pra não estourar API OpenAI
  const results = await Promise.all(candidates.map((c) => runSilenceFollowUp(c)));
  const sent = results.filter((r) => r.ok).length;
  const abandoned = results.filter((r) => r.abandoned).length;
  const errors = results.filter((r) => !r.ok).map((r) => ({ conversationId: r.conversationId, error: r.error }));

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    abandoned,
    errors,
  });
}
