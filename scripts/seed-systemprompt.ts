/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 * 
 * Script para popular o system prompt no banco usando o DEFAULT_SYSTEM_PROMPT
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SYSTEM_PROMPT } from "../src/lib/ai";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log(`System prompt: ${DEFAULT_SYSTEM_PROMPT.length} caracteres`);
    
    // Salva no banco
    await prisma.settings.upsert({
      where: { key: "system_prompt" },
      update: { value: DEFAULT_SYSTEM_PROMPT },
      create: {
        id: "system_prompt",
        key: "system_prompt",
        value: DEFAULT_SYSTEM_PROMPT,
        encrypted: false,
      },
    });
    
    console.log("System prompt salvo no banco com sucesso!");
    
    // Verifica
    const saved = await prisma.settings.findUnique({
      where: { key: "system_prompt" },
    });
    
    console.log(`Verificacao: ${saved?.value?.length || 0} caracteres salvos`);
    console.log(`Preview: ${saved?.value?.substring(0, 200)}...`);
  } catch (error) {
    console.error("Erro ao salvar system prompt:", error);
  }
}

main().finally(() => prisma.$disconnect());
