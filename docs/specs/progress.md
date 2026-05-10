# Progress — Assistente Max

**Última atualização:** 2026-05-10
**Sessão atual:** Fase 2 parcial (schema + seeds; migration pendente por Node 20)

## Fase atual: 2 — Schema 360° (90% — bloqueado em migration)

### Concluído na Fase 2

- [x] `prisma/schema.prisma` atualizado com modelos novos:
  - `Vehicle` (placa, marca, modelo, ano, km, medidaPneu, últimos serviços)
  - `ServiceCategory` + `ServiceItem` (catálogo de serviços)
  - `TireProduct` (catálogo de pneus)
  - `Quote` + `QuoteItem` (orçamento) + enum `QuoteStatus`
  - `Sale` (venda fechada) + enum `SaleStatus`
  - `ServiceLog` (histórico de serviço executado)
  - `NPSResponse` (pesquisa pós-venda)
  - `FollowUpRule` (regras de follow-up configuráveis)
- [x] Campos novos em `Lead`: `cpf`, `followUpOptOut`, relations (vehicles, quotes, sales, nps)
- [x] Campos novos em `User`: relations vendedorQuotes / vendedorSales
- [x] Campos novos em `FollowUp`: `type`, `vehicleId`, `saleId`, `serviceLogId`, `ruleId`, `template`, `sentAt` + indexes
- [x] Campos novos em `Organization`: relations quotes, sales, followUpRules
- [x] `scripts/seed-followup-rules.ts` (8 regras default conforme `docs/specs/follow-up-rules.md`)
- [x] `scripts/seed-catalog.ts` (consome `agent/pneuzero-catalog.json`; com fallback de categorias placeholder se JSON não existe)

### Bloqueios

- 🔴 **Node 20.18.2** instalado, **Prisma 7 exige Node ≥22.12**. Toda CLI Prisma (`prisma format`, `prisma validate`, `prisma migrate dev`) falha com `ERR_REQUIRE_ESM`. Bloqueio **idêntico** ao da Fase 1 — fora do escopo das fases, problema de ambiente.
- Sem `prisma migrate dev`, sem migration aplicada. Schema só existe em arquivo.

### Pendências para fechar Fase 2

1. **Atualizar Node ≥22** no ambiente (nvm install 22; nvm use 22).
2. Rodar:
   ```bash
   npx prisma format
   npx prisma validate
   npx prisma migrate dev --name fase2_360_cliente_veiculo
   npx prisma generate
   ```
3. Rodar `npx tsx scripts/seed-followup-rules.ts`.
4. Para catálogo:
   ```bash
   npm install -D playwright
   npx playwright install chromium
   npx tsx scripts/scrape-pneuzero.ts
   # revisar agent/pneuzero-raw.json, criar pneuzero-catalog.json curado
   npx tsx scripts/seed-catalog.ts
   ```

### Próximo passo

Após Node ≥22 e migration aplicada, partir para **Fase 3 — IA cotação (tool-calling)**.

Em paralelo (independe de migration): rodar scraper e curar `pneuzero-catalog.json`.

Spec Fase 3: [03-fase3-ia-cotacao.md](03-fase3-ia-cotacao.md).

---

## Histórico de fases

- [x] **Fase 1 — Limpeza** (concluída em 2026-05-10)
- [~] **Fase 2 — Schema 360°** (schema escrito; migration bloqueada por Node 20)
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
| 2026-05-10 | Endpoint `api/knowledge/seed` apagado |
| 2026-05-10 | `Vehicle` é tabela separada (não `LeadMemory`) |
| 2026-05-10 | `QuoteItem.precoUnit` é snapshot (preço congela na criação) |
| 2026-05-10 | `Sale.vendedorId` obrigatório; bot fechou → user `bot@pneuzero.local` |
| 2026-05-10 | `FollowUpRule.organizationId + tipo` unique (1 regra por tipo por org) |

---

## Arquivos modificados nesta sessão

```
M  prisma/schema.prisma         (Lead, User, Organization, FollowUp + 9 modelos novos)
A  scripts/seed-followup-rules.ts
A  scripts/seed-catalog.ts
M  docs/specs/progress.md
```

## Ambiente requerido

- Node ≥22.12 (declarado em `package.json` engines)
- Postgres com extensões `vector` + `uuid-ossp` (já no schema)
- OpenAI API Key (em `OrgSettings` ou env)
- Evolution API rodando + webhook configurado
