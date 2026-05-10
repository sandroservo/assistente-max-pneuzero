# Progress — Assistente Max

**Última atualização:** 2026-05-10
**Sessão atual:** Fase 3 entregue (tool-calling)

## Fase atual: 3 — IA cotação consultiva ✅ entregue (cotação real precisa de catálogo de pneus)

### Concluído

- [x] `src/lib/extractors.ts` — regex placa (Mercosul + antiga), medida pneu, km, ano
- [x] `src/lib/vehicle.ts` — `upsertVehicle`, `getVehiclesByLead`, `formatVehiclesForAI`
- [x] `src/lib/tools.ts` — 4 tools OpenAI:
  - `registrar_veiculo` (placa, modelo, ano, km, medida)
  - `buscar_pneu` (filtro por medida + marca opcional)
  - `buscar_servico` (categoria ou termo)
  - `transferir_humano` (cria `Handoff` + muda lead p/ `HUMANO_SOLICITADO`)
- [x] `src/lib/ai.ts` integrado:
  - Extrator de veículo roda em toda mensagem in → upsert automático
  - `<VeículoLead>` injetado no contexto
  - Loop tool-calling até 4 rounds (`tool_choice: "auto"`)
  - `conversationId` adicionado ao `ConversationContext`
- [x] `agent/systemprompt.md` atualizado: instruções para usar tools antes de cotar
- [x] `npm run build` passa
- [x] `npx tsc --noEmit` exit 0

### Pendências para fechar Fase 3 100%

- [ ] Popular `TireProduct` com pneus reais (depende do dono passar marcas/preços — não está no site).
- [ ] Caller do `generateAIResponse` precisa passar `conversationId` (webhook Evolution). **Verificar** se já passa via `context`.
- [ ] Teste manual end-to-end com chave OpenAI válida + WhatsApp real.

### Bloqueios

- Sem TireProduct seedado → `buscar_pneu` sempre retorna vazio + aviso de transferir para humano. Comportamento esperado quando catálogo vazio, mas precisa ser preenchido para tool ter valor real.

### Próximo passo

**Fase 4 — Pós-venda + follow-up automático.**

1. Criar `scripts/run-followups.ts` (job scheduler de cron a cada 10min).
2. Auto-criar `FollowUp` quando:
   - `Sale.status` muda para `CONCLUIDA` → NPS D+1
   - `ServiceLog` `alinhamento` → 90 dias
   - `ServiceLog` `troca_pneu` → 180 dias
   - `ServiceLog` `troca_oleo` → calcular próxima por `Vehicle.kmEstimadoMes`
   - `Lead.birthDate` hoje → aniversário 9h
   - `Lead.status NOVO` há 3 dias sem msg in → reativação
3. Parser de NPS: cliente responde 0-10 após FollowUp `nps_d1` → cria `NPSResponse` + ações por categoria.
4. Detector opt-out: "para de me mandar", "remove meu número" → `Lead.followUpOptOut = true`.

Spec completa: [04-fase4-pos-venda.md](04-fase4-pos-venda.md).

---

## Histórico de fases

- [x] **Fase 1 — Limpeza** (2026-05-10)
- [x] **Fase 2 — Schema 360°** (2026-05-10, via `db push` por consentimento)
- [x] **Fase 3 — IA cotação** (2026-05-10)
- [ ] Fase 4 — Pós-venda + follow-up (próxima)
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
| 2026-05-10 | Endpoint `api/knowledge/seed` apagado |
| 2026-05-10 | `Vehicle` é tabela separada (não `LeadMemory`) |
| 2026-05-10 | `QuoteItem.precoUnit` é snapshot |
| 2026-05-10 | `Sale.vendedorId` obrigatório |
| 2026-05-10 | `FollowUpRule.organizationId + tipo` unique |
| 2026-05-10 | Fase 2 aplicada via `db push` (banco quase vazio) |
| 2026-05-10 | Tool-calling com loop de até 4 rounds |
| 2026-05-10 | Extrator regex de placa/medida/km/ano roda ANTES da IA (sem custo de tool) |

---

## Ambiente

- Node 22.22.2 (via nvm)
- Postgres com `vector` + `uuid-ossp`
- Playwright + Chromium headless instalados
- Schema sincronizado com banco

## Comandos úteis

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm run dev
npm run build
npx prisma studio
npx prisma db push                       # sync sem migration
npx prisma migrate dev --name <nome>     # cria migration formal
npx tsx scripts/scrape-pneuzero.ts       # atualiza agent/pneuzero-raw.json
npx tsx scripts/seed-knowledge-full.ts   # apaga e recria base
npx tsx scripts/seed-catalog.ts          # popula serviços/categorias/pneus
npx tsx scripts/seed-followup-rules.ts   # popula regras
```
