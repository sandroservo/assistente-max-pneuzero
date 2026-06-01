/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Retorna a chave pública VAPID pro browser registrar a subscription.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/web-push";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const pub = getVapidPublicKey();
  if (!pub) return NextResponse.json({ error: "Web Push não configurado" }, { status: 503 });
  return NextResponse.json({ publicKey: pub });
}
