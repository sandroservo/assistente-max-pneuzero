# Fase 1 — Limpeza Amo Vidas/Vi

Remover todo resíduo do projeto antigo (Vi/Amo Vidas) antes de evoluir.

## Objetivos

1. Código 100% Pneuzero — sem `amovidas`, `vi`, `clube`, `Plano Rotina`.
2. Prompt Max consistente em todos os pontos (`agent/`, `ai.ts`, fallback).
3. Documentação raiz (`README.md`, `CONTEXT.md`) reflete projeto atual.
4. Scraper do site Pneuzero rodando — gera JSON do catálogo (entrada da Fase 2).

## Arquivos a apagar

- `src/lib/amovidas-api.ts` — cliente API cobrança Amo Vidas
- `agent/Infromações amovidas.md` — material referência Vi
- `agent/club de desconto.md` — clube desconto Amo Vidas
- `docs/DNS-vi.amovidas.md` — DNS subdomínio Vi

## Arquivos a reescrever

### `src/lib/ai.ts`

- **Remover** import `listarClientesVencidos, hasCobrancaToken` (linha 13)
- **Remover** bloco cobrança linhas 158-188 (`cobrancaKeywords`, `listarClientesVencidos`)
- **Reescrever** `generateFallbackResponse` (linhas 494-519): tirar "Essencial R$37,90/Completo R$59,90/Premium R$99,90" — trocar por fallback Pneuzero ("Como posso te chamar?", "Sobre que serviço quer saber?")
- **Verificar** comentário linha 227 "planos, parceiros do Clube de Desconto" → trocar por "pneus, serviços, preços, garantias"

### `agent/systemprompt.md`

Substituir TODO conteúdo pelo prompt Max oficial (ver [system-prompt-max.md](system-prompt-max.md)). Tirar referências Vi, Amo Vidas, "consultora de saúde", planos saúde.

### `CONTEXT.md`

Reescrever: nome do projeto (Max/Pneuzero), stack, status atual, arquivos importantes. Não citar Vi.

### `README.md`

Verificar e atualizar título, descrição, comandos `npm run` (alguns ainda mencionam `atualizar-vi`).

### `package.json`

Verificar scripts: `atualizar-vi` → `atualizar-max` ou `seed:knowledge`.

### `scripts/seed-knowledge-full.ts`

Já está majoritariamente Pneuzero. **Verificar** se ainda tem item com keywords `amovidas`, `clube`, `plano-rotina` e remover.

### `docker/env.example`

Remover `AMOVIDAS_API_URL` e `AMOVIDAS_AGENT_TOKEN`.

### `docs/instruções.txt`, `docs/walkthrough.md`, `docs/progress.md`

Verificar e atualizar referências Vi → Max.

## Scraper Pneuzero (entrega paralela)

`scripts/scrape-pneuzero.ts` — usa Playwright para renderizar SPA e extrair:

- Lista de serviços com descrição
- Marcas de pneus comercializadas
- Endereços/filiais
- Telefones/WhatsApp
- Horário funcionamento
- Formas pagamento
- Garantias declaradas
- Redes sociais

Saída: `agent/pneuzero-catalog.json` (consumido na Fase 2 para popular `Catalog`/`TireProduct`).

Detalhes em [scraper-pneuzero.md](scraper-pneuzero.md).

## Critério de aceite

- [ ] `grep -ri "amovidas\|amo vidas\|clube de desconto\|consultora de saúde" src/ agent/ docs/ scripts/ README.md CONTEXT.md` retorna vazio
- [ ] `npm run dev` sobe sem erro
- [ ] Conversa de teste no painel: Max responde como Pneuzero, sem mencionar plano saúde
- [ ] `agent/pneuzero-catalog.json` existe e tem pelo menos: 1 serviço, 1 marca pneu, 1 endereço, 1 telefone
- [ ] `npm run build` passa
- [ ] Commit único de cleanup com mensagem clara

## Riscos

- **Fallback** quebrar quando OpenAI falha — testar com chave inválida.
- **Site SPA bloqueia headless** — fallback: rodar com `headless: false` numa máquina com display, ou pedir HTML salvo ao dono.
- **Resíduos em migrations** — `prisma/migrations` tem nome antigo? Verificar mas **não renomear migration aplicada** (criar nova se necessário).
