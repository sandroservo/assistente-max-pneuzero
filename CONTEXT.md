# Assistente Max – Contexto do projeto

Contexto para a IA (e para a equipe) saber **onde paramos** no projeto do Max — consultor de vendas da Pneuzero Maranhão.

---

## O que é o projeto

- **Nome:** Assistente Max / Pneuzero
- **Stack:** Next.js 16, Prisma (PostgreSQL + pgvector), Evolution API (WhatsApp), OpenAI (Whisper, Vision, Chat).
- **Função:** Painel para gerenciar o Max (vendedor consultivo no WhatsApp): inbox, leads, base de conhecimento, handoff humano, configurações. Webhook recebe mensagens da Evolution e responde com IA.
- **Cliente:** Pneuzero Maranhão (loja de pneus + serviços automotivos: alinhamento, balanceamento, suspensão, freios, óleo, elétrica, baterias).

---

## Roadmap

Documentado em [docs/specs/](docs/specs/). Estado atual em [docs/specs/progress.md](docs/specs/progress.md).

| Fase | Entrega |
|------|---------|
| 1 | Limpeza resíduos Amo Vidas (projeto anterior) + scraper site Pneuzero |
| 2 | Schema 360° — `Vehicle`, `Catalog`, `Quote`, `Sale`, `ServiceLog`, `NPSResponse` |
| 3 | IA cotação consultiva via OpenAI tool-calling |
| 4 | Pós-venda + follow-up automático (NPS D+1, revisão 3m, troca óleo, aniversário) |
| 5 | Dashboard 360° — ficha completa do cliente com timeline |

---

## Capacidades atuais

1. **Suporte a áudio** — Mensagens de áudio são transcritas (Whisper) no webhook; texto vira mensagem do usuário. Mensagem salva com `type: "audio"`.
2. **Suporte a imagem** — Imagens são descritas (Vision / gpt-4o-mini) no webhook; descrição vira contexto para a IA. Mensagem salva com `type: "image"`.
3. **Human in the loop** — Se a mensagem é `fromMe` (atendente enviou pelo WhatsApp), o lead passa para `ownerType: "human"` e o Max para de responder até alguém clicar em "Devolver ao Bot" no painel.
4. **Lista de exceção** — Em Configurações → aba **Exceções**: números para o Max **não** responder (ex.: pessoas da empresa).
5. **Base de conhecimento** — Catálogo de serviços, pneus, checklist por idade do veículo (gerenciado via [scripts/seed-knowledge-full.ts](scripts/seed-knowledge-full.ts)).

---

## Como atualizar a base de conhecimento

```bash
npm run atualizar-max
# ou
npm run seed:knowledge
```

Roda `scripts/seed-knowledge.ts` → `seed-knowledge-full.ts`: **apaga** toda a base atual e **insere** os itens definidos em `KNOWLEDGE_DATA`.

**Arquivo a editar para mudar o que o Max sabe:** [scripts/seed-knowledge-full.ts](scripts/seed-knowledge-full.ts).

---

## Arquivos importantes

| Área | Caminho |
|------|---------|
| Specs do produto | [docs/specs/](docs/specs/) |
| Webhook Evolution | [src/app/api/webhooks/evolution/route.ts](src/app/api/webhooks/evolution/route.ts) |
| IA (prompt, conhecimento, status do lead) | [src/lib/ai.ts](src/lib/ai.ts) |
| Mídia (Whisper, Vision) | [src/lib/media.ts](src/lib/media.ts) |
| Evolution (envio, base64 mídia) | [src/lib/evolution.ts](src/lib/evolution.ts) |
| Lista de exceção (API) | [src/app/api/excluded-contacts/](src/app/api/excluded-contacts/) |
| Lista de exceção (UI) | [src/app/(dashboard)/settings/ui/ExcludedContactsCard.tsx](src/app/(dashboard)/settings/ui/ExcludedContactsCard.tsx) |
| Schema Prisma | [prisma/schema.prisma](prisma/schema.prisma) |
| Base de conhecimento (seed) | [scripts/seed-knowledge-full.ts](scripts/seed-knowledge-full.ts) |
| Prompt sistema (Max) | [agent/systemprompt.md](agent/systemprompt.md) |
| Agente de desenvolvimento | [.claude/agents/max-dev.md](.claude/agents/max-dev.md) |

---

## Documentação complementar

- [docs/specs/README.md](docs/specs/README.md) — índice e princípios
- [docs/specs/progress.md](docs/specs/progress.md) — estado atual do desenvolvimento
- [docs/FLUXO-N8N-ANALISE.md](docs/FLUXO-N8N-ANALISE.md) – Análise dos fluxos n8n e o que foi aproveitado
- [docs/MELHORIAS-CODIGO.md](docs/MELHORIAS-CODIGO.md) – Melhorias de segurança e multitenancy

---

*Atualize este arquivo quando fizer entregas ou mudar prioridades.*
