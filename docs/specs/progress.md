# Progress — Assistente Max

**Última atualização:** 2026-05-10
**Sessão atual:** Fase 5 entregue — roadmap completo 🎉

## Status: TODAS AS 5 FASES ENTREGUES

| Fase | Status | Commit |
|------|--------|--------|
| 1 — Limpeza Amo Vidas/Vi | ✅ | `89c6a38` |
| 2 — Schema 360° (Vehicle, Quote, Sale, ServiceLog, NPS, FollowUpRule) | ✅ | `4ef0670` + `65c9cad` |
| 3 — IA tool-calling | ✅ | `6e574f5` |
| 4 — Pós-venda + follow-up automático | ✅ | `49c98e0` |
| 5 — Dashboard 360° | ✅ | (este commit) |

### Concluído na Fase 5

- [x] `src/app/(dashboard)/leads/[id]/page.tsx` — server component que carrega lead com 200 mensagens, veículos, cotações, vendas, NPS, follow-ups, service logs. Serializa Decimals/Dates.
- [x] `src/app/(dashboard)/leads/[id]/ui/Lead360.tsx` — client component com:
  - Header: avatar, nome, status, tags, telefone/email/cidade/aniversário, badge opt-out, KPIs (Score / Vendas total / NPS médio)
  - **Tab Timeline**: agrega Message + Quote + Sale + ServiceLog + NPSResponse + FollowUp ordenado por data desc, com ícones por tipo e cor por categoria
  - **Tab Veículos**: card por `Vehicle` (placa, modelo, ano, cor, pneu, km, últimos serviços, observações)
  - **Tab Vendas**: card por `Sale` (status, total, pagamento, parcelas, vendedor, veículo, NPS, service logs executados)
  - **Tab NPS**: cards coloridos por categoria (verde/amarelo/vermelho)
  - **Tab Follow-ups**: lista pending + histórico, mostra erros se houver
- [x] `src/app/(dashboard)/page.tsx` — dashboard home ganha 4 KPIs Pneuzero:
  - Vendas no mês (R$ + qtd)
  - NPS médio do mês + qtd respostas
  - Follow-ups pendentes
  - Veículos cadastrados
- [x] `npm run build` passa; rota `/leads/[id]` registrada
- [x] `npx tsc --noEmit` exit 0

### Pendências futuras (fora do roadmap original)

- [ ] **Tab Catálogo** — CRUD `TireProduct` + `ServiceItem` no painel (hoje só via seed/Prisma Studio)
- [ ] **Link da kanban para `/leads/[id]`** — adicionar onClick nos cards
- [ ] **Criar follow-up manual** — formulário UI
- [ ] **Relatórios** — NPS por vendedor, faturamento por categoria, pneus mais vendidos (`/reports` existe mas precisa adaptar)
- [ ] **Lead frio** generators (3d, 15d) e garantia vencendo — adicionar a `run-followups.ts`
- [ ] **Hook automático** Sale → onSaleConcluida via UI/API endpoint
- [ ] **Marcas/preços reais de pneus** — pendente do dono (não está no site)

### Comandos de operação

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm run dev                                     # painel local
npm run build                                   # compila
npx prisma studio                               # editar dados
npx tsx scripts/run-followups.ts                # processa follow-ups
npx tsx scripts/seed-knowledge-full.ts          # atualiza base RAG
npx tsx scripts/seed-catalog.ts                 # popula catálogo
npx tsx scripts/seed-followup-rules.ts          # popula regras
npx tsx scripts/scrape-pneuzero.ts              # re-extrai site
```

### Cron sugerido

```cron
*/10 * * * * cd /home/developer/www/assistente-max && \
  source /home/developer/.nvm/nvm.sh && nvm use 22 >/dev/null && \
  npx tsx scripts/run-followups.ts >> /var/log/max-followups.log 2>&1
```

---

## Decisões registradas

| Data | Decisão |
|------|---------|
| 2026-05-10 | Pivot Amo Vidas/Vi → Pneuzero/Max |
| 2026-05-10 | Roadmap em 5 fases, ordem sequencial |
| 2026-05-10 | Atribuição venda = quem fez handoff |
| 2026-05-10 | Catálogo via Playwright scraper |
| 2026-05-10 | 12 specs em `docs/specs/` |
| 2026-05-10 | Vehicle como tabela separada (não LeadMemory) |
| 2026-05-10 | QuoteItem.precoUnit é snapshot |
| 2026-05-10 | Sale.vendedorId obrigatório |
| 2026-05-10 | FollowUpRule (org, tipo) unique |
| 2026-05-10 | Fase 2 aplicada via db push (banco quase vazio) |
| 2026-05-10 | Tool-calling com loop até 4 rounds |
| 2026-05-10 | Extrator regex antes da IA (sem custo) |
| 2026-05-10 | Job follow-up roda a cada 10 min via cron |
| 2026-05-10 | Anti-spam: pula follow-up se lead respondeu <24h |
| 2026-05-10 | NPS parser exige resposta curta (≤50 chars) |
| 2026-05-10 | Detrator NPS → handoff automático |
| 2026-05-10 | Timeline 360° agrega tudo num componente client |

---

## Ambiente

- Node 22.22.2 (via nvm)
- Postgres com extensões `vector` + `uuid-ossp`
- Playwright + Chromium headless
- Schema sincronizado com banco
- 8 ServiceCategory, 6 ServiceItem (catálogo real Pneuzero)
- 8 FollowUpRule, 14 Knowledge

## Estado final

Aplicação **pronta para uso operacional**:
- Max responde no WhatsApp via webhook Evolution + OpenAI tool-calling
- Veículo capturado automaticamente (regex placa/medida/km)
- Cotações, vendas e serviços persistidos no banco
- Follow-up automático via cron (NPS, alinhamento, rodízio, troca óleo, aniversário)
- Detrator NPS dispara handoff automático
- Opt-out por palavra-chave
- Ficha 360° por lead no painel
- Dashboard home com KPIs do negócio

Próximo nível: relatórios avançados, CRUD UI completo, integração financeira.
