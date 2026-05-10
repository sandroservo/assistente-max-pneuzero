# Critérios de Movimentação do Kanban — Assistente Max (Pneuzero)

> **Autor:** Sandro Servo
> **Site:** https://cloudservo.com.br
> **Última atualização:** 2026-05-10

---

## Visão Geral

O Kanban do Assistente Max organiza os leads no funil de vendas da Pneuzero. Cada coluna representa uma etapa do atendimento, da primeira mensagem até o serviço executado. Movimentação acontece de duas formas:

1. **Automática** — o Max (IA) ou o sistema detecta sinais na conversa e move o lead.
2. **Manual** — o atendente arrasta o card no Kanban ou usa botões de ação.

---

## Etapas do funil

| ID interno | Coluna | O que significa |
|---|---|---|
| `NOVO` | 🆕 Novo Lead | Lead acabou de mandar a primeira mensagem |
| `EM_ATENDIMENTO` | 🔍 Em Triagem | Max coletando dados (medida de pneu, ano do carro, km, serviço desejado) |
| `CONSCIENTIZADO` | 📋 Cotação Enviada | Max já passou preço com montagem/balanceamento incluso |
| `QUALIFICADO` | 🎯 Quer Agendar | Cliente demonstrou intenção real (perguntou pagamento, "quero levar") |
| `EM_NEGOCIACAO` | 💬 Negociando | Discutindo forma de pagamento, parcelas, possíveis descontos |
| `AGUARDANDO_RESPOSTA` | ⏳ Aguardando Resposta | Cliente parou de responder; follow-ups agendados |
| `HUMANO_SOLICITADO` | 🙋 Aguardando Atendente | Cliente pediu humano ou Max acionou handoff |
| `HUMANO_EM_ATENDIMENTO` | 👤 Em Atendimento Humano | Atendente assumiu a conversa; bot não responde mais |
| `FECHADO` | ✅ Fechado / Agendado | Cliente confirmou que vai levar o carro / pagou / agendou data |
| `LEAD_FRIO` | 🥶 Lead Frio | Cliente hesitou ("vou pensar", "depois eu vejo") |
| `PERDIDO` | ❌ Perdido | Cliente desistiu, escolheu concorrente ou pediu desconsiderar |

---

## Categorias (filtro por aba)

| ID | Aba | Quando usar |
|---|---|---|
| `geral` | Geral | Default — sem categoria definida |
| `pneus` | 🛞 Pneus | Compra/troca de pneu |
| `alinhamento` | ⚙️ Alinhamento/Balanc. | Alinhamento, balanceamento, geometria 3D |
| `suspensao` | 🔧 Suspensão | Amortecedor, mola, bucha, bieleta |
| `freios` | 🛑 Freios | Pastilha, disco, lona, fluido |
| `oleo` | 🛢️ Óleo & Filtros | Troca de óleo, filtro de óleo/ar/combustível |
| `eletrica` | 🔋 Elétrica/Bateria | Bateria, alternador, parte elétrica |
| `revisao` | 🔍 Revisão Completa | Checklist + múltiplos serviços |

---

## Transições Automáticas (Max / Sistema)

### 1. NOVO → EM_ATENDIMENTO

- **Quando:** Lead trocou ≥ 2 mensagens com o Max e ainda não demonstrou intenção clara de comprar.
- **Objetivo:** Diferenciar quem só mandou "oi" de quem está conversando de verdade.

### 2. NOVO / EM_ATENDIMENTO → CONSCIENTIZADO

- **Quando:** Max chamou as tools `buscar_pneu` ou `buscar_servico` e respondeu com preço.
- **Sinal complementar:** Cliente já passou medida do pneu OU ano do veículo + serviço desejado.

### 3. CONSCIENTIZADO → QUALIFICADO

- **Quando:** Lead demonstra intenção concreta de fechar.
- **Palavras-chave detectadas:**
  - "quero levar o carro", "pode agendar", "quero fechar", "vou levar"
  - "como faço pra agendar", "qual o melhor dia", "tem horário pra amanhã"
  - "vou querer", "fechado então", "pode marcar"

### 4. QUALIFICADO → EM_NEGOCIACAO

- **Quando:** Discussão de forma de pagamento ou desconto.
- **Palavras-chave:** "pix", "cartão", "parcelado", "tem desconto", "quanto à vista", "no boleto"

### 5. EM_NEGOCIACAO → FECHADO

- **Quando:** Cliente confirma compra/agendamento.
- **Palavras-chave:**
  - "fechado", "combinado", "pode mandar"
  - "vou pagar", "vou levar amanhã", "tô indo agora"
  - "pague aqui", "fiz o pix", "paguei"

### 6. Qualquer → LEAD_FRIO

- **Quando:** Cliente demonstra hesitação ou esfriamento.
- **Palavras-chave:**
  - "vou pensar", "preciso pensar", "depois eu vejo"
  - "talvez", "não agora", "mais tarde", "outro dia"
  - "semana que vem", "mês que vem", "deixa eu ver"
- **Objetivo:** Priorizar reativação via follow-up.

### 7. Qualquer → PERDIDO

- **Quando:** Cliente desiste ou escolhe concorrente.
- **Palavras-chave:**
  - "não tenho interesse", "não quero", "não preciso", "desisto"
  - "muito caro", "sem condições", "tá fora do meu orçamento"
  - "já comprei em outro lugar", "já fiz em outra borracharia"
  - "deixa pra lá", "esquece"

### 8. Qualquer → HUMANO_SOLICITADO

- **Quando:** Cliente pede atendente humano OU Max chama a tool `transferir_humano`.
- **Palavras-chave:**
  - "quero falar com atendente", "humano", "pessoa real"
  - "gerente", "reclamação", "falar com alguém"
- **Ação:** `Lead.status = HUMANO_SOLICITADO`, `ownerType = human`. Bot para de responder.

### 9. Qualquer → AGUARDANDO_RESPOSTA

- **Quando:** Lead já em `EM_ATENDIMENTO` ou `CONSCIENTIZADO` há > 24h sem responder.
- **Ação:** Cron de follow-up agenda mensagens (`lead_frio_3d`, `lead_frio_15d`).

---

## Transições por ação do atendente

### 10. Qualquer → HUMANO_EM_ATENDIMENTO

- **Gatilho:** Atendente clica "Iniciar atendimento" no painel OU envia mensagem direto pelo WhatsApp da loja (Evolution detecta `fromMe`).
- **Efeito:** Bot para. Atendente que pegou vira `vendedor` responsável de qualquer venda nascida nesta conversa.

### 11. HUMANO_EM_ATENDIMENTO → EM_ATENDIMENTO

- **Gatilho:** Atendente clica "Devolver para Max (Bot)".
- **Efeito:** Max volta a responder.

### 12. Drag & drop no Kanban

- **Gatilho:** Atendente arrasta card para outra coluna.
- **Efeito:** `Lead.status` atualiza pra coluna destino. Aceita qualquer transição (override manual).

---

## Transições por integração (futuro)

| Evento | Resultado |
|---|---|
| `Sale.status = CONCLUIDA` | Lead permanece `FECHADO`. Cron agenda `nps_d1` (pesquisa pós-venda) |
| `NPSResponse.categoria = detrator` | Cria `Handoff` automático para gerência. Lead vira `HUMANO_SOLICITADO` |
| `Lead.followUpOptOut = true` | Sai de qualquer fluxo de follow-up automático |

---

## Fluxo visual

```
┌───────────────────┐
│   🆕 Novo Lead     │  primeira msg
└─────────┬─────────┘
          │ ≥2 msgs
          ▼
┌───────────────────┐
│  🔍 Em Triagem    │  Max coleta medida pneu, ano, km
└─────────┬─────────┘
          │ Max cotou
          ▼
┌───────────────────┐
│ 📋 Cotação Enviada │  preço com montagem/balanc. inclusos
└─────────┬─────────┘
          │ "quero agendar"
          ▼
┌───────────────────┐
│  🎯 Quer Agendar  │
└─────────┬─────────┘
          │ "qual a forma de pagamento"
          ▼
┌───────────────────┐
│   💬 Negociando   │  pix, cartão, parcelado
└─────────┬─────────┘
          │ "fechado, vou levar"
          ▼
┌───────────────────┐
│ ✅ Fechado / Agendado │
└───────────────────┘

Em paralelo a qualquer etapa:
  ⏳ Aguardando Resposta   (sem resposta > 24h)
  🥶 Lead Frio              ("vou pensar")
  ❌ Perdido                ("não quero", "muito caro")
  🙋 Aguardando Atendente   (lead pediu humano)
  👤 Em Atendimento Humano  (atendente assumiu)
```

---

## Observações importantes

1. **Prioridade de detecção:** PERDIDO > FECHADO > QUALIFICADO > LEAD_FRIO > EM_ATENDIMENTO. Se o lead diz "não quero" e "quanto custa" na mesma mensagem, prevalece `PERDIDO`.

2. **Status protegido:** Lead **não regride automaticamente** de `FECHADO`. Detecção automática só promove para `QUALIFICADO` se o status atual **não for** `FECHADO`.

3. **Detecção contextual:** Keywords de `PERDIDO`, `FECHADO`, `LEAD_FRIO` são verificadas **na mensagem atual**. Já `QUALIFICADO`/`CONSCIENTIZADO` consideram o histórico (sinais acumulados + uso de tools).

4. **Follow-ups automáticos:** Cron `*/10 * * * *` (`scripts/run-followups.ts`) processa `FollowUp` pendente. Anti-spam: pula se cliente respondeu nas últimas 24h.

5. **Handoff por mensagem direta:** Se um atendente envia mensagem pelo WhatsApp da loja (sem usar o painel), o webhook detecta `fromMe`, marca `ownerType = human` e move pra `HUMANO_EM_ATENDIMENTO`.

6. **NPS pós-venda:** Após `Sale.status = CONCLUIDA`, cron agenda mensagem D+1 às 14h pedindo nota 0-10. Detrator (≤6) dispara handoff para gerência.

---

## Arquivo da UI

[`src/app/(dashboard)/leads/ui/LeadsKanban.tsx`](../src/app/(dashboard)/leads/ui/LeadsKanban.tsx) — constantes `COLUMNS` (etapas) e `CATEGORIES` (abas).

Detecção de status fica em [`src/lib/ai.ts`](../src/lib/ai.ts), função `detectLeadStatus()`.
