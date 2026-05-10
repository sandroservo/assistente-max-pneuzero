/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Scraper do site Pneuzero Maranhão (SPA Vite/React).
 * Renderiza JS via Playwright e extrai conteúdo bruto.
 *
 * Setup (rodar UMA VEZ):
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * Uso:
 *   npx tsx scripts/scrape-pneuzero.ts
 *
 * Saída: agent/pneuzero-raw.json (consumido por parse-pneuzero-catalog.ts)
 */

import fs from "node:fs";
import path from "node:path";

const BASE = "https://pneuzeromaranhao.com.br";
const OUT_DIR = path.join(process.cwd(), "agent");
const OUT_FILE = path.join(OUT_DIR, "pneuzero-raw.json");

interface PageData {
  url: string;
  title: string;
  text: string;
  html?: string;
  links?: { text: string; href: string }[];
  images?: { alt: string; src: string }[];
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "❌ Playwright não instalado.\n" +
        "Rode: npm install -D playwright && npx playwright install chromium"
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (compatible; PneuzeroBot/1.0)",
  });

  console.log(`🌐 Acessando ${BASE}...`);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("body", { timeout: 10000 });
  await page.waitForTimeout(2000);

  const home = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: document.body.innerText,
    html: document.body.innerHTML,
    links: Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).map((a) => ({
      text: a.innerText.trim(),
      href: a.href,
    })),
    images: Array.from(document.querySelectorAll<HTMLImageElement>("img")).map((img) => ({
      alt: img.alt,
      src: img.src,
    })),
  }));

  const pages: Record<string, PageData> = { [BASE]: home };

  const internalLinks = Array.from(
    new Set(
      home.links
        .filter((l) => l.href.startsWith(BASE) && !l.href.includes("#"))
        .map((l) => l.href)
    )
  );

  console.log(`🔗 ${internalLinks.length} páginas internas encontradas`);

  for (const url of internalLinks) {
    if (pages[url]) continue;
    try {
      console.log(`  → ${url}`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      const data = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        text: document.body.innerText,
      }));
      pages[url] = data;
    } catch (e) {
      console.warn(`  ⚠️  Falhou ${url}:`, (e as Error).message);
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(pages, null, 2));

  await browser.close();
  console.log(`\n✅ OK — ${Object.keys(pages).length} páginas em ${OUT_FILE}`);
  console.log("Próximo passo: revisar manualmente e criar parse-pneuzero-catalog.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
