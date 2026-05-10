# Progress — Assistente Max

**Última atualização:** 2026-05-10
**Sessão atual:** Fase 1 executada

## Fase atual: 2 — Schema 360° cliente + veículo (pronto para iniciar)

Progresso Fase 1: 11 / 11 tarefas (100%) ✅

### Concluído na Fase 1

- [x] Apagado `src/lib/amovidas-api.ts`
- [x] Removido import + bloco cobrança em `src/lib/ai.ts` (linhas antigas 13, 158-188)
- [x] `generateFallbackResponse` reescrito sem "planos R$37,90/59,90/99,90" — agora orienta sobre pneus/serviços
- [x] Comentário "planos, parceiros do Clube de Desconto" em `ai.ts` linha 193 trocado por "pneus, serviços, preços, garantias"
- [x] `agent/systemprompt.md` reescrito 100% Pneuzero/Max (conforme `docs/specs/system-prompt-max.md`)
- [x] `CONTEXT.md` reescrito (Max/Pneuzero, links para specs)
- [x] Apagado `agent/Infromações amovidas.md` e `agent/club de desconto.md`
- [x] `docker/env.example` já estava limpo (sem AMOVIDAS_*)
- [x] `package.json` script já era `atualizar-max` (não precisou mexer)
- [x] Apagado endpoint legacy `src/app/api/knowledge/seed/route.ts` (hardcoded com dados saúde, duplicava `seed-knowledge-full.ts`)
- [x] Limpado `scripts/seed-contacts.ts` (removido contato Amo Vidas, array vazio com exemplo Pneuzero)
- [x] Criado `scripts/scrape-pneuzero.ts` (Playwright SPA scraper)

### Validação

- ✅ `grep` Amo Vidas: clean (único match é referência histórica em CONTEXT.md descrevendo a fase)
- ✅ `npx tsc --noEmit` passa (exit 0)
- ⚠️ `npm run build` falha — erro pré-existente: Node 20.18.2 instalado, Prisma 7 exige Node ≥22.12 (declarado em package.json engines). NÃO introduzido pela Fase 1.

### Pendências carregadas para Fase 2

- [ ] **Instalar Playwright** quando for rodar scraper:
  ```bash
  npm install -D playwright
  npx playwright install chromium
  ```
- [ ] **Rodar scraper** e revisar `agent/pneuzero-raw.json`
- [ ] **Criar `scripts/parse-pneuzero-catalog.ts`** para gerar `agent/pneuzero-catalog.json` estruturado
- [ ] **Atualizar Node para ≥22** no ambiente de dev (problema de ambiente, fora do escopo das fases)
- [ ] **Refactor hint pré-existente**: variável `combined` declarada e não usada em `src/lib/ai.ts:518` (deixar para próximo cleanup de brinde)

### Bloqueios

Nenhum bloqueador para iniciar Fase 2. Schema 360° pode ser desenhado em paralelo ao scraping do catálogo.

### Próximo passo

Iniciar **Fase 2 — Schema 360° cliente + veículo**:
1. Atualizar `prisma/schema.prisma` com modelos novos (`Vehicle`, `ServiceCategory`, `ServiceItem`, `TireProduct`, `Quote`, `QuoteItem`, `Sale`, `ServiceLog`, `NPSResponse`, `FollowUpRule`)
2. Adicionar campos em `Lead`, `User`, `FollowUp`
3. `npx prisma migrate dev --name fase2_360_cliente_veiculo`
4. Criar `scripts/seed-followup-rules.ts` (8 regras default)
5. Em paralelo: rodar scraper, parsear catálogo, criar `scripts/seed-catalog.ts`

Spec completa em [02-fase2-schema.md](02-fase2-schema.md).

---

## Histórico de fases

- [x] **Fase 1 — Limpeza** (concluída em 2026-05-10)
- [ ] Fase 2 — Schema 360° (próxima)
- [ ] Fase 3 — IA cotação
- [ ] Fase 4 — Pós-venda + follow-up
- [ ] Fase 5 — Dashboard 360°

---

## Decisões registradas

| Data | Decisão |
|------|---------|
| 2026-05-10 | Pivot Amo Vidas/Vi → Pneuzero/Max |
| 2026-05-10 | Roadmap em 5 fases, ordem sequencial |
| 2026-05-10 | Atribuição venda = quem fez handoff |
| 2026-05-10 | Catálogo via Playwright scraper |
| 2026-05-10 | 12 specs em `docs/specs/` |
| 2026-05-10 | Endpoint `api/knowledge/seed` apagado (substituído por `scripts/seed-knowledge-full.ts`) |

---

## Arquivos modificados na Fase 1

```
M  CONTEXT.md
M  agent/systemprompt.md
M  src/lib/ai.ts
M  scripts/seed-contacts.ts
M  docs/specs/progress.md
D  src/lib/amovidas-api.ts
D  src/app/api/knowledge/seed/route.ts
D  agent/Infromações amovidas.md
D  agent/club de desconto.md
A  scripts/scrape-pneuzero.ts
A  docs/specs/* (12 arquivos novos da etapa de specs)
A  .claude/agents/max-dev.md
```
