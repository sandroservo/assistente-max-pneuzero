/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * SSE stream do chat interno. Cada conexão escuta o teamBus e filtra
 * eventos da organização do usuário. Mensagens DM são filtradas para
 * só os membros do par. Keep-alive a cada 25s.
 */

import { auth } from "@/lib/auth";
import { teamBus, type TeamBroadcast } from "@/lib/team-bus";
import { isUserInDm } from "@/lib/team-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const orgId = session.user.organizationId;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller fechado
        }
      };

      send("ready", { ok: true });

      const handler = (ev: TeamBroadcast) => {
        if (ev.organizationId !== orgId) return;
        if (ev.type === "message" && ev.message) {
          // Filtra DM: só para os 2 membros
          if (ev.message.dmKey && !isUserInDm(userId, ev.message.dmKey)) return;
          send("message", ev.message);
        } else if (ev.type === "seen" && ev.seen) {
          // Só envia seen do próprio usuário (sincroniza abas)
          if (ev.seen.userId === userId) send("seen", ev.seen);
        }
      };

      const unsubscribe = teamBus.subscribe(handler);

      // Keep-alive (comentário SSE — proxy não fecha por idle)
      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ka\n\n`));
        } catch {
          clearInterval(ka);
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(ka);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
