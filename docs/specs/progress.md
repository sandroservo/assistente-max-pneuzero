# Progress — Assistente Max

**Última atualização:** 2026-05-10
**Sessão atual:** Fase 4 entregue (pós-venda + follow-up automático)

## Fase atual: 4 — Pós-venda + follow-up ✅ entregue

### Concluído

#### Fase 1 ✅
Limpeza Amo Vidas/Vi, prompt Max consistente, scraper Pneuzero criado.

#### Fase 2 ✅
Schema 360° aplicado via `db push`, catálogo real Pneuzero curado (BR-010, Imperatriz/MA; vendas (99) 99145-8080; 6 serviços), 8 follow-up rules, 14 itens de Knowledge.

#### Fase 3 ✅
Tool-calling OpenAI: `registrar_veiculo`, `buscar_pneu`, `buscar_servico`, `transferir_humano`. Extrator automático placa/medida/km/ano. `Vehicle` upsert por placa. Loop até 4 rounds.

#### Fase 4 (esta sessão)
- [x] `src/lib/followup-engine.ts`:
  - `renderTemplate` (substitui `{{primeiro_nome}}`, `{{veiculo_modelo}}`, `{{cupom}}`, etc.)
  - `onSaleConcluida(saleId)` — agenda NPS D+1 conforme regra
  - `onServiceLogCreated(serviceLogId)` — agenda alinhamento_3m / rodizio_6m / troca_oleo_km
  - `scheduleBirthdayFollowUps()` — varre aniversariantes do dia, evita duplicatas no mesmo ano
  - `processPendingFollowUps()` — envia via Evolution; anti-spam (pula se lead respondeu nas últimas 24h); registra Message out
  - `detectOptOut(text)` — frases "para de me mandar", "remove meu número", etc.
- [x] `src/lib/nps.ts`:
  - `extractNPSScore(text)` — só aceita resposta curta (≤50 chars) com nota 0-10
  - `categorizarNPS(nota)` — detrator/neutro/promotor
  - `findPendingNPS(leadId)` — busca follow-up NPS recente (7 dias) sem resposta
  - `recordNPSResponse()` — cria `NPSResponse` + handoff automático se detrator
  - `npsReplyMessage(categoria)` — resposta automática por categoria
- [x] `scripts/run-followups.ts` — job cron (cada 10min): `scheduleBirthdayFollowUps` + `processPendingFollowUps`
- [x] Webhook `evolution/route.ts` integrado:
  - Antes da IA: `detectOptOut` → seta `Lead.followUpOptOut = true`
  - Antes da IA: `findPendingNPS` + `extractNPSScore` → registra resposta e fecha conversa de NPS
- [x] `npm run build` passa

### Como ativar o job

```bash
crontab -e
# adicionar:
*/10 * * * * cd /home/developer/www/assistente-max && \
  source /home/developer/.nvm/nvm.sh && nvm use 22 >/dev/null && \
  npx tsx scripts/run-followups.ts >> /var/log/max-followups.log 2>&1
```

### Pendências

- [ ] **Disparar `onSaleConcluida` / `onServiceLogCreated`** ao fechar venda / registrar serviço no painel. Hoje as funções existem; falta a UI (Fase 5) e/ou endpoint que dispare.
- [ ] **Hooks Prisma middleware** (alternativa): disparar dentro de `prisma.sale.update({status:CONCLUIDA})` automaticamente — avaliar na Fase 5.
- [ ] **Lead frio 3d / 15d**: gerador ainda não implementado (precisa job adicional que varre leads). Adicionar em iteração futura.
- [ ] **Garantia vencendo**: precisa job adicional que varre `ServiceLog.garantiaAte`.
- [ ] **Teste end-to-end**: simular Sale concluída → cron → mensagem chega → cliente responde nota → NPSResponse + reply.

### Próximo passo

**Fase 5 — Dashboard 360°**

1. `/leads/[id]` ganha tabs: Timeline, Veículos, Vendas, NPS, Follow-ups.
2. Componente `<Timeline>` agrega: Message + Quote + Sale + ServiceLog + NPSResponse + FollowUp.
3. Tab Veículos: card por `Vehicle` com últimos serviços + próxima manutenção estimada.
4. Tab Vendas: tabela com vendedor responsável.
5. Tab NPS: cards com cor por categoria.
6. Tab Follow-ups: pending + histórico, botão criar manual.
7. `/dashboard` home com KPIs reais.
8. `/catalog` CRUD pneus/serviços.

Spec completa: [05-fase5-dashboard.md](05-fase5-dashboard.md).

---

## Histórico de fases

- [x] **Fase 1 — Limpeza** (2026-05-10)
- [x] **Fase 2 — Schema 360°** (2026-05-10)
- [x] **Fase 3 — IA cotação** (2026-05-10)
- [x] **Fase 4 — Pós-venda + follow-up** (2026-05-10)
- [ ] Fase 5 — Dashboard 360° (próxima)

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
| 2026-05-10 | Fase 2 aplicada via db push |
| 2026-05-10 | Tool-calling com loop até 4 rounds |
| 2026-05-10 | Extrator regex antes da IA (sem custo) |
| 2026-05-10 | Job follow-up roda a cada 10 min via cron |
| 2026-05-10 | Anti-spam: pula follow-up se lead respondeu nas últimas 24h |
| 2026-05-10 | NPS parser exige resposta curta (≤50 chars) com nota 0-10 |
| 2026-05-10 | Detrator NPS → handoff automático para gerência |

---

## Ambiente

- Node 22.22.2 (via nvm)
- Postgres + vector + uuid-ossp
- Playwright + Chromium
- Build Next.js OK

## Comandos

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm run dev
npm run build
npx tsx scripts/run-followups.ts          # processa fila + agenda aniversários
npx tsx scripts/seed-followup-rules.ts    # 8 regras default
npx tsx scripts/seed-catalog.ts           # catálogo Pneuzero
npx tsx scripts/seed-knowledge-full.ts    # base RAG
npx tsx scripts/scrape-pneuzero.ts        # re-extrai site
```
