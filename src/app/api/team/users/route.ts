/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Lista vendedores da organização (exceto o próprio usuário) para o chat interno.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      active: true,
      NOT: { id: session.user.id },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      lastLoginAt: true,
    },
  });

  return NextResponse.json({ users });
}
