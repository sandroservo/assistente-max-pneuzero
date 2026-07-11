/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Hook de startup do Next. Inicia o worker de disparo em massa uma vez por
 * processo (só no runtime Node, não no Edge). Retoma jobs pendentes no banco
 * após restart do serviço.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBroadcastWorker } = await import("@/lib/broadcast");
    startBroadcastWorker();
  }
}
