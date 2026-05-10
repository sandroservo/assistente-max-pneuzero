# Scraper Pneuzero — extração do catálogo

Site oficial `pneuzeromaranhao.com.br` é SPA Vite/React. `curl`/`WebFetch` não enxergam conteúdo (só shell HTML). Precisa renderizar JS.

## Estratégia

Playwright headless → renderiza página → extrai DOM → gera JSON estruturado.

## Setup

```bash
npm install -D playwright
npx playwright install chromium
```

## Script proposto

`scripts/scrape-pneuzero.ts`:

```ts
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "https://pneuzeromaranhao.com.br";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (compatible; PneuzeroBot/1.0)",
  });

  await page.goto(BASE, { waitUntil: "networkidle" });

  // espera SPA hidratar
  await page.waitForSelector("body", { timeout: 10000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const text = document.body.innerText;
    const links = Array.from(document.querySelectorAll("a")).map((a) => ({
      text: a.innerText.trim(),
      href: (a as HTMLAnchorElement).href,
    }));
    const images = Array.from(document.querySelectorAll("img")).map((img) => ({
      alt: img.alt,
      src: (img as HTMLImageElement).src,
    }));
    return { text, links, images, html: document.body.innerHTML };
  });

  // descobre páginas internas
  const internalLinks = data.links
    .filter((l) => l.href.startsWith(BASE))
    .map((l) => l.href);

  const pages: Record<string, any> = { [BASE]: data };

  for (const url of new Set(internalLinks)) {
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const pageData = await page.evaluate(() => ({
        text: document.body.innerText,
        title: document.title,
      }));
      pages[url] = pageData;
    } catch (e) {
      console.warn(`Falhou ${url}:`, e);
    }
  }

  fs.writeFileSync(
    "agent/pneuzero-raw.json",
    JSON.stringify(pages, null, 2)
  );

  await browser.close();
  console.log("OK — agent/pneuzero-raw.json gerado");
}

main();
```

## Parser → catálogo estruturado

`scripts/parse-pneuzero-catalog.ts` consome `pneuzero-raw.json` e gera `pneuzero-catalog.json`:

```json
{
  "empresa": {
    "nome": "Pneuzero Maranhão",
    "telefones": ["+5598..."],
    "whatsapp": "+5598...",
    "enderecos": [
      { "filial": "Centro", "rua": "...", "cidade": "São Luís", "uf": "MA" }
    ],
    "horario": {
      "segSex": "08:00-18:00",
      "sab": "08:00-13:00",
      "dom": "fechado"
    },
    "redesSociais": {
      "instagram": "...",
      "facebook": "..."
    },
    "formasPagamento": ["pix", "dinheiro", "cartao_credito", "cartao_debito", "parcelado"]
  },
  "marcasPneu": ["Pirelli", "Michelin", "Goodyear", "Continental", "Bridgestone"],
  "servicos": [
    {
      "categoria": "Alinhamento",
      "nome": "Alinhamento 3D",
      "descricao": "..."
    },
    {
      "categoria": "Balanceamento",
      "nome": "Balanceamento eletrônico",
      "descricao": "..."
    }
  ],
  "diferenciais": [
    "Montagem grátis",
    "Bicos grátis",
    "Avaliação gratuita"
  ],
  "garantias": [
    { "servico": "Alinhamento", "dias": 90 }
  ]
}
```

## Fallback se scraper não pegar tudo

Se SPA carrega conteúdo via API privada que o scraper não acessa, ou se layout é puro imagem:

1. **Pedir ao dono** — texto do site (institucional, lista serviços) num `.md`.
2. **Manual** — preencher `pneuzero-catalog.json` à mão a partir de prints/PDF.
3. **Instagram scraping** — usa Playwright em instagram.com/pneuzeromaranhao para extrair captions de posts.

## Critério de aceite

- [ ] `npm run scrape:pneuzero` gera `agent/pneuzero-raw.json` sem erro
- [ ] `npm run parse:pneuzero` gera `agent/pneuzero-catalog.json` com mínimo: 1 endereço, 1 telefone, lista de marcas, lista de serviços
- [ ] Catálogo passa por revisão humana antes de virar seed
- [ ] Re-rodar scraper sobre catálogo existente preserva edições manuais (merge, não overwrite)

## Quando re-rodar

- Antes de cada release maior
- Mensalmente como rotina (cron)
- Após dono avisar mudança de preço/serviço
