/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * SSE org-wide de notificações in-app. Cada vendedor logado mantém uma
 * conexão e recebe lead_new, appointment_request, handoff, appointment_imminent.
 */

import { auth } from "@/lib/auth";
import { notifyBus, type Notif } from "@/lib/notifications-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const orgId = session.user.organizationId;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // ignore
        }
      };
      send("ready", { ok: true });

      const handler = (n: Notif) => {
        if (n.organizationId !== orgId) return;
        send("notif", n);
      };
      const unsub = notifyBus.subscribe(handler);

      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ka\n\n`));
        } catch {
          clearInterval(ka);
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(ka);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
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
