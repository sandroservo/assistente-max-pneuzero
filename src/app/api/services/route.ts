/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Lista catálogo de ServiceItem ativos da organização (sem filtro org porque
 * ServiceItem hoje é catálogo compartilhado — futuro multitenant: filtrar).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const services = await prisma.serviceItem.findMany({
    where: { ativo: true },
    orderBy: [{ category: { nome: "asc" } }, { nome: "asc" }],
    include: {
      category: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      nome: s.nome,
      descricao: s.descricao,
      precoBase: s.precoBase?.toString() ?? null,
      duracaoMin: s.duracaoMin,
      categoria: s.category.nome,
      categoriaId: s.category.id,
    })),
  });
}
