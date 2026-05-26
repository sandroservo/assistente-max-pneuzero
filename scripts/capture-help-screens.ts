/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Captura screenshots PNG + vídeos WebM curtos das telas principais
 * pra usar nos tutoriais /ajuda.
 *
 * Uso:
 *   HELP_BASE_URL=https://pneuzero.cloudservo.com.br \
 *   HELP_EMAIL=screenshot@pneuzero.com \
 *   HELP_PASSWORD=xxx \
 *   npx tsx scripts/capture-help-screens.ts
 *
 * Saída:
 *   public/ajuda/<slug>.png  (screenshot estático)
 *   public/ajuda/<slug>.webm (vídeo curto ~3-6s navegando)
 */

import { chromium, type BrowserContext, type Page } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.HELP_BASE_URL ?? "https://pneuzero.cloudservo.com.br";
const EMAIL = process.env.HELP_EMAIL ?? "";
const PASSWORD = process.env.HELP_PASSWORD ?? "";
const OUT_DIR = path.join(process.cwd(), "public", "ajuda");
const VIEWPORT = { width: 1440, height: 900 };

interface Capture {
  slug: string;
  path: string;
  description: string;
  waitFor?: string; // selector pra aguardar
  clickAfter?: string; // clica em algo após carregar (ex: abrir modal)
  videoActions?: (page: Page) => Promise<void>; // ações extras pra demonstrar feature no vídeo
}

const CAPTURES: Capture[] = [
  {
    slug: "dashboard",
    path: "/",
    description: "Dashboard inicial",
    waitFor: "h1",
  },
  {
    slug: "chats-inbox",
    path: "/chats",
    description: "Inbox /chats",
    waitFor: "aside, [class*='sidebar']",
    videoActions: async (p) => {
      await p.waitForTimeout(800);
      // Tenta clicar no campo de busca pra dar dinamismo
      await p.click("input[type='search'], input[placeholder*='Buscar']").catch(() => null);
      await p.waitForTimeout(500);
    },
  },
  {
    slug: "equipe",
    path: "/equipe",
    description: "Chat interno /equipe",
    waitFor: "aside",
    videoActions: async (p) => {
      await p.waitForTimeout(800);
      // Clica em Geral
      await p.click("button:has-text('Geral')").catch(() => null);
      await p.waitForTimeout(500);
    },
  },
  {
    slug: "agendamentos-lista",
    path: "/agendamentos",
    description: "Lista de agendamentos",
    waitFor: "h1",
    videoActions: async (p) => {
      await p.waitForTimeout(800);
      await p.click("select").catch(() => null);
      await p.waitForTimeout(500);
    },
  },
  {
    slug: "agendamentos-modal",
    path: "/agendamentos",
    description: "Modal Novo agendamento",
    waitFor: "h1",
    clickAfter: "button:has-text('Novo agendamento')",
    videoActions: async (p) => {
      await p.click("button:has-text('Novo agendamento')").catch(() => null);
      await p.waitForTimeout(1000);
      await p.click("input[placeholder*='Buscar']").catch(() => null);
      await p.waitForTimeout(500);
    },
  },
  {
    slug: "kanban",
    path: "/kanban",
    description: "Kanban de leads",
    waitFor: "h1, [class*='kanban']",
  },
  {
    slug: "settings",
    path: "/settings",
    description: "Configurações",
    waitFor: "h1",
    videoActions: async (p) => {
      await p.waitForTimeout(800);
      await p.evaluate(() => window.scrollBy(0, 300));
      await p.waitForTimeout(500);
    },
  },
  {
    slug: "knowledge",
    path: "/knowledge",
    description: "Base de conhecimento",
    waitFor: "h1",
  },
  {
    slug: "users",
    path: "/users",
    description: "Usuários",
    waitFor: "h1",
  },
];

async function login(page: Page) {
  page.on("response", (r) => {
    if (r.url().includes("/api/auth") || r.status() >= 400) {
      console.log(`  [net] ${r.status()} ${r.url()}`);
    }
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForSelector("input[type='email'], input[name='email']", { timeout: 15_000 });
  await page.fill("input[type='email'], input[name='email']", EMAIL);
  await page.fill("input[type='password'], input[name='password']", PASSWORD);
  console.log("  → form preenchido, submetendo…");
  await page.click("button[type='submit']").catch(() => page.press("input[type='password']", "Enter"));
  // Espera redirect OU mensagem de erro
  await page.waitForTimeout(5000);
  const url = page.url();
  const errText = await page.locator("text=/erro|inv[áa]lido|incorret/i").first().textContent({ timeout: 1000 }).catch(() => null);
  if (errText) console.log("  ! erro visível:", errText);
  if (url.includes("/login")) {
    // Snapshot pra debug
    await page.screenshot({ path: "/tmp/login-debug.png" });
    const html = await page.content();
    fs.writeFileSync("/tmp/login-debug.html", html);
    throw new Error(`Login não saiu da /login. URL: ${url}. Snapshot: /tmp/login-debug.png + /tmp/login-debug.html`);
  }
  console.log("✓ Login OK →", url);
}

async function captureScreenshot(ctx: BrowserContext, sessionCookies: { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: "Strict" | "Lax" | "None" }[], c: Capture) {
  const out = path.join(OUT_DIR, `${c.slug}.png`);
  await ctx.addCookies(sessionCookies);
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}${c.path}`, { waitUntil: "domcontentloaded" });
    if (c.waitFor) await page.waitForSelector(c.waitFor, { timeout: 10_000 }).catch(() => null);
    await page.waitForTimeout(700);
    if (c.clickAfter) {
      await page.click(c.clickAfter).catch(() => console.warn(`  ! falhou clique ${c.clickAfter}`));
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: out });
    const stat = fs.statSync(out);
    console.log(`✓ ${c.slug}.png (${(stat.size / 1024).toFixed(0)}KB)`);
  } finally {
    await page.close();
  }
}

async function captureVideo(c: Capture, sessionCookies: { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: "Strict" | "Lax" | "None" }[]) {
  const browser = await chromium.launch({ headless: true });
  const tmpVideoDir = path.join(OUT_DIR, "_tmp_video");
  fs.mkdirSync(tmpVideoDir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1, // video em 1x pra arquivo menor
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    recordVideo: { dir: tmpVideoDir, size: VIEWPORT },
  });
  await ctx.addCookies(sessionCookies);
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}${c.path}`, { waitUntil: "domcontentloaded" });
    if (c.waitFor) await page.waitForSelector(c.waitFor, { timeout: 10_000 }).catch(() => null);
    await page.waitForTimeout(1200);
    if (c.videoActions) await c.videoActions(page);
    else await page.waitForTimeout(1500);
    await page.waitForTimeout(500);
  } finally {
    await page.close();
    await ctx.close();
    await browser.close();
  }

  // Encontra o vídeo gerado e renomeia
  const files = fs.readdirSync(tmpVideoDir).filter((f) => f.endsWith(".webm"));
  if (files.length > 0) {
    const generated = path.join(tmpVideoDir, files[0]);
    const target = path.join(OUT_DIR, `${c.slug}.webm`);
    fs.renameSync(generated, target);
    const stat = fs.statSync(target);
    console.log(`✓ ${c.slug}.webm (${(stat.size / 1024).toFixed(0)}KB)`);
  } else {
    console.warn(`✗ ${c.slug}.webm não gerado`);
  }
  // Cleanup tmp dir
  try {
    const remaining = fs.readdirSync(tmpVideoDir);
    remaining.forEach((f) => fs.unlinkSync(path.join(tmpVideoDir, f)));
    fs.rmdirSync(tmpVideoDir);
  } catch { /* ignore */ }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("HELP_EMAIL e HELP_PASSWORD obrigatórios");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1ª passada: faz login uma vez, pega cookies de sessão
  console.log("=== Login ===");
  const loginBrowser = await chromium.launch({ headless: true });
  const loginCtx = await loginBrowser.newContext({
    viewport: VIEWPORT,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const loginPage = await loginCtx.newPage();
  await login(loginPage);
  const cookies = await loginCtx.cookies();
  await loginBrowser.close();
  console.log(`✓ ${cookies.length} cookies de sessão capturados`);

  // 2ª passada: screenshots PNG (1 contexto reutilizado)
  console.log("\n=== Screenshots PNG ===");
  const ssBrowser = await chromium.launch({ headless: true });
  const ssCtx = await ssBrowser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // retina
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  for (const c of CAPTURES) {
    try {
      await captureScreenshot(ssCtx, cookies, c);
    } catch (err) {
      console.error(`✗ ${c.slug} (screenshot): ${err instanceof Error ? err.message : err}`);
    }
  }
  await ssBrowser.close();

  // 3ª passada: vídeos WebM (1 contexto por captura por causa do recordVideo)
  console.log("\n=== Vídeos WebM ===");
  for (const c of CAPTURES) {
    try {
      await captureVideo(c, cookies);
    } catch (err) {
      console.error(`✗ ${c.slug} (vídeo): ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
