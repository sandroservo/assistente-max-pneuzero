/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * API para gerenciar Tags
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET - Lista todas as tags da organização
export async function GET() {
    try {
        // TODO: Pegar organizationId do session/auth
        const tags = await prisma.tag.findMany({
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ tags });
    } catch (error) {
        console.error("Erro ao buscar tags:", error);
        return NextResponse.json({ tags: [] }, { status: 500 });
    }
}

// POST - Cria uma nova tag
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, color, organizationId } = body;

        if (!name || !organizationId) {
            return NextResponse.json(
                { error: "Nome e organizationId são obrigatórios" },
                { status: 400 }
            );
        }

        const tag = await prisma.tag.create({
            data: {
                name,
                color: color || "#FE3E6E",
                organizationId,
            },
        });

        return NextResponse.json({ tag }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar tag:", error);
        return NextResponse.json({ error: "Erro ao criar tag" }, { status: 500 });
    }
}
