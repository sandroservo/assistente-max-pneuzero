/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Popula catálogo Pneuzero: ServiceCategory, ServiceItem, TireProduct.
 *
 * Fonte: agent/pneuzero-catalog.json (gerado a partir do scraper + revisão manual).
 *
 * Setup:
 *   1. npx tsx scripts/scrape-pneuzero.ts       (gera pneuzero-raw.json)
 *   2. Revisar/curar manualmente -> pneuzero-catalog.json
 *   3. npx tsx scripts/seed-catalog.ts
 *
 * Estrutura esperada do JSON em docs/specs/scraper-pneuzero.md
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CATALOG_PATH = path.join(process.cwd(), "agent", "pneuzero-catalog.json");

interface Catalog {
  empresa?: Record<string, unknown>;
  marcasPneu?: string[];
  servicos?: {
    categoria: string;
    nome: string;
    descricao?: string;
    precoBase?: number;
    garantiaDias?: number;
    duracaoMin?: number;
  }[];
  pneus?: {
    marca: string;
    modelo: string;
    medida: string;
    aro: number;
    uso?: string;
    preco?: number;
    estoque?: number;
  }[];
}

// Fallback enquanto pneuzero-catalog.json não existe.
// Substituir após rodar scraper + curadoria.
const PLACEHOLDER_CATEGORIES = [
  "Alinhamento",
  "Balanceamento",
  "Suspensão",
  "Freios",
  "Óleo",
  "Elétrica",
  "Bateria",
];

async function main() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.warn(
      `⚠️  ${CATALOG_PATH} não existe. Criando categorias placeholder.\n` +
        `   Para popular de verdade: rode scripts/scrape-pneuzero.ts e gere o JSON curado.`
    );
    for (const nome of PLACEHOLDER_CATEGORIES) {
      await prisma.serviceCategory.upsert({
        where: { nome },
        create: { nome },
        update: {},
      });
      console.log(`  ✅ Categoria '${nome}'`);
    }
    return;
  }

  const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));

  // Categorias derivadas dos serviços
  const categoriasSet = new Set<string>(PLACEHOLDER_CATEGORIES);
  catalog.servicos?.forEach((s) => categoriasSet.add(s.categoria));

  const categoriasIds = new Map<string, string>();
  for (const nome of categoriasSet) {
    const cat = await prisma.serviceCategory.upsert({
      where: { nome },
      create: { nome },
      update: {},
    });
    categoriasIds.set(nome, cat.id);
  }
  console.log(`Categorias: ${categoriasSet.size}`);

  // Serviços
  let svcCount = 0;
  for (const svc of catalog.servicos ?? []) {
    const categoryId = categoriasIds.get(svc.categoria);
    if (!categoryId) continue;
    await prisma.serviceItem.create({
      data: {
        categoryId,
        nome: svc.nome,
        descricao: svc.descricao ?? null,
        precoBase: svc.precoBase ?? null,
        garantiaDias: svc.garantiaDias ?? null,
        duracaoMin: svc.duracaoMin ?? null,
      },
    });
    svcCount++;
  }
  console.log(`Serviços: ${svcCount}`);

  // Pneus
  let tireCount = 0;
  for (const tire of catalog.pneus ?? []) {
    await prisma.tireProduct.upsert({
      where: {
        marca_modelo_medida: {
          marca: tire.marca,
          modelo: tire.modelo,
          medida: tire.medida,
        },
      },
      create: {
        marca: tire.marca,
        modelo: tire.modelo,
        medida: tire.medida,
        aro: tire.aro,
        uso: tire.uso ?? null,
        preco: tire.preco ?? null,
        estoque: tire.estoque ?? 0,
      },
      update: {
        preco: tire.preco ?? null,
        estoque: tire.estoque ?? 0,
      },
    });
    tireCount++;
  }
  console.log(`Pneus: ${tireCount}`);

  console.log("\n✅ Catálogo seedado");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
