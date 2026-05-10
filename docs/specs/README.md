# Specs — Assistente Max / Pneuzero

Documento vivo. Fonte da verdade do produto. Atualize sempre que decisão mudar.

## Contexto

Projeto pivotou de **Assistente Vi (Amo Vidas / saúde)** para **Assistente Max (Pneuzero Maranhão / pneus e serviços automotivos)**.

Objetivo: Max é vendedor consultivo no WhatsApp que conhece TODOS os serviços e produtos da Pneuzero, mantém perfil 360° do cliente (dados + veículo(s) + histórico), e dispara pós-venda e follow-up automaticamente.

## Índice

| # | Doc | Resumo |
|---|-----|--------|
| 00 | [Visão geral](00-visao-geral.md) | Produto, atores, métricas, roadmap |
| 01 | [Fase 1 — Limpeza](01-fase1-limpeza.md) | Remover resíduos Amo Vidas/Vi |
| 02 | [Fase 2 — Schema 360°](02-fase2-schema.md) | Vehicle, Catalog, Quote, Sale, ServiceLog |
| 03 | [Fase 3 — IA cotação](03-fase3-ia-cotacao.md) | Tool-calling: cotar, agendar, registrar veículo |
| 04 | [Fase 4 — Pós-venda + follow-up](04-fase4-pos-venda.md) | NPS, revisão, troca óleo, aniversário |
| 05 | [Fase 5 — Dashboard 360°](05-fase5-dashboard.md) | Ficha completa do cliente |
| — | [Data model](data-model.md) | Schema Prisma proposto (todas tabelas) |
| — | [Scraper Pneuzero](scraper-pneuzero.md) | Como extrair catálogo do site SPA |
| — | [System prompt Max](system-prompt-max.md) | Prompt oficial do Max |
| — | [Regras follow-up](follow-up-rules.md) | Gatilhos e templates |
| — | [Glossário](glossario.md) | Termos do domínio |

## Princípios

1. **Não inventar** — preço, marca, garantia: só o que veio do catálogo Pneuzero.
2. **Histórico imutável** — mensagem, cotação, venda, serviço: append-only. Edição vira `updatedAt` + log.
3. **Veículo é cidadão de 1ª classe** — não é "memória do lead". Tabela própria com FK.
4. **Vendedor sempre identificado** — toda venda tem `vendedorId` (humano ou `bot`).
5. **Follow-up é dado, não código** — regras em `FollowUpRule` (config), não hard-coded.

## Status atual

- ✅ Schema base: `Lead`, `Conversation`, `Message`, `FollowUp`, `Handoff`, `Knowledge`, `LeadMemory`
- ✅ Prompt Max funcional ([src/lib/ai.ts](../../src/lib/ai.ts))
- ✅ Webhook Evolution + handoff humano + transcrição áudio/imagem
- ⚠️ Resíduos Amo Vidas em `amovidas-api.ts`, fallback `ai.ts:494-519`, `agent/systemprompt.md`, `CONTEXT.md`
- ❌ Sem catálogo estruturado (pneus, serviços, preços)
- ❌ Sem `Vehicle`, `Quote`, `Sale`, `ServiceLog`, `NPSResponse`
- ❌ Follow-up não tipado, não contextual
