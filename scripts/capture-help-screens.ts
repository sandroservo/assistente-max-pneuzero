/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Captura screenshots das telas principais pra usar nos tutoriais /ajuda.
 * Roda local, loga em produção (ou env BASE_URL) e salva PNGs em /public/ajuda/.
 *
 * Uso:
 *   HELP_BASE_URL=https://pneuzero.cloudservo.com.br \
 *   HELP_EMAIL=screenshot@pneuzero.com \
 *   HELP_PASSWORD=xxx \
 *   npx tsx scripts/capture-help-screens.ts
 */

import { chromium, type Page } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.HELP_BASE_URL ?? "https://pneuzero.cloudservo.com.br";
const EMAIL = process.env.HELP_EMAIL ?? "";
const PASSWORD = process.env.HELP_PASSWORD ?? "";
const OUT_DIR = path.join(process.cwd(), "public", "ajuda");

interface Capture {
  slug: string;
  path: string;
  description: string;
  fullPage?: boolean;
  waitFor?: string; // selector pra aguardar
  clickAfter?: string; // clica em algo após carregar (ex: abrir modal)
  delay?: number;
}

const CAPTURES: Capture[] = [
  { slug: "chats-inbox", path: "/chats", description: "Inbox /chats", fullPage: false, waitFor: "h1, [class*='sidebar']" },
  { slug: "equipe", path: "/equipe", description: "Chat interno /equipe", fullPage: false, waitFor: "h2, [class*='conversa']" },
  { slug: "agendamentos-lista", path: "/agendamentos", description: "Lista de agendamentos", fullPage: false, waitFor: "h1" },
  { slug: "agendamentos-modal", path: "/agendamentos", description: "Modal Novo agendamento", fullPage: false, waitFor: "h1", clickAfter: 'button:has-text("Novo agendamento")', delay: 600 },
  { slug: "kanban", path: "/kanban", description: "Kanban de leads", fullPage: false, waitFor: "h1" },
  { slug: "settings", path: "/settings", description: "Configurações", fullPage: false, waitFor: "h1" },
  { slug: "knowledge", path: "/knowledge", description: "Base de conhecimento", fullPage: false, waitFor: "h1" },
  { slug: "users", path: "/users", description: "Usuários", fullPage: false, waitFor: "h1" },
  { slug: "dashboard", path: "/", description: "Dashboard inicial", fullPage: false, waitFor: "h1, [class*='grid']" },
];

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  console.log("✓ Login OK");
}

async function capture(page: Page, c: Capture) {
  const out = path.join(OUT_DIR, `${c.slug}.png`);
  await page.goto(`${BASE_URL}${c.path}`, { waitUntil: "domcontentloaded" });
  if (c.waitFor) {
    await page.waitForSelector(c.waitFor, { timeout: 10_000 }).catch(() => null);
  }
  await page.waitForTimeout(500);
  if (c.clickAfter) {
    await page.click(c.clickAfter).catch(() => console.warn(`  ! não consegui clicar em ${c.clickAfter}`));
    await page.waitForTimeout(c.delay ?? 400);
  }
  await page.screenshot({ path: out, fullPage: c.fullPage });
  const stat = fs.statSync(out);
  console.log(`✓ ${c.slug}.png (${(stat.size / 1024).toFixed(0)}KB) — ${c.description}`);
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("HELP_EMAIL e HELP_PASSWORD obrigatórios (env vars)");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await ctx.newPage();

  try {
    await login(page);
    for (const c of CAPTURES) {
      try {
        await capture(page, c);
      } catch (err) {
        console.error(`✗ ${c.slug}: ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
