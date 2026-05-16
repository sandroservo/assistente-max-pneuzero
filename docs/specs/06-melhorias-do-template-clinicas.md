# 06 — Melhorias do template "Kanban Clínicas"

Análise do workflow `docs/KANBAN-CLINICAS-INSTALADOR.json` (template
fazer.ai/Lucas Moreira para n8n) e gaps que podemos cobrir no Max.

## Comparativo

| Funcionalidade | Template Clínicas | Max (atual) | Status |
|---|---|---|---|
| Atendimento WhatsApp + IA | ✅ (Chatwoot) | ✅ (Evolution direto) | OK |
| Atendimento Instagram Direct | ✅ trigger único | ❌ | 🔴 GAP |
| Memória de conversa por contato | ✅ Postgres chat memory | ✅ LeadMemory | OK |
| **Google Calendar — buscar janelas livres** | ✅ | ❌ | 🔴 GAP |
| **Google Calendar — criar/atualizar/cancelar evento** | ✅ | ❌ | 🔴 GAP |
| **Múltiplos profissionais com agenda própria** | ✅ | ❌ | 🔴 GAP |
| Reagir mensagem com emoji | ✅ tool | ❌ | 🟡 GAP |
| Áudio resposta (ElevenLabs) | ✅ | ❌ | 🟡 GAP |
| Vision (descrever imagem) | ✅ | ✅ | OK |
| Escalonamento humano | ✅ etiqueta + alerta atendente | ✅ Handoff | OK (refinar) |
| Lembrete pré-consulta (D-1) | ✅ | ❌ | 🔴 GAP |
| Pós-venda 24h (NPS) | ✅ agente dedicado | ✅ NPS D+1 | OK |
| Follow-up qualificado (multi-stage) | ✅ 1º + 2º + despedida | ⚠️ só `lead_frio_3d/15d` | 🟡 GAP |
| No-show específico (empático) | ✅ agente próprio | ❌ | 🔴 GAP |
| **3-strike rule** (após N follow-ups → PERDIDO) | ✅ | ❌ | 🔴 GAP |
| **Múltiplos agentes especializados por etapa** | ✅ (4 agentes diferentes) | 1 agente único | 🟡 GAP |
| Kanban com etapas dinâmicas | ✅ via Chatwoot board | ⚠️ enum LeadStatus | 🟡 GAP |

## Roadmap Fase 6 (proposto)

### Fase 6A — Agendamento real (alto impacto)

Pneuzero hoje: cliente diz "quero levar amanhã", Max responde "te transfiro pra atendente". Solução: agendamento direto.

**Schema novo**:

```prisma
model Box {
  id           String @id @default(cuid())
  organizationId String
  nome         String  // "Box 1", "Alinhamento", "Box Pesados"
  tipo         String  // "alinhamento" | "balanceamento" | "pneu" | "geral"
  capacidade   Int     @default(1)  // veículos simultâneos
  ativo        Boolean @default(true)
  calendarId   String? // Google Calendar ID (opcional)
  appointments Appointment[]
}

model Appointment {
  id           String   @id @default(cuid())
  organizationId String
  leadId       String
  vehicleId    String?
  saleId       String?
  boxId        String
  serviceItemIds String[] // serviços a executar
  startsAt     DateTime
  endsAt       DateTime
  status       String   // pending | confirmed | done | no_show | canceled
  observations String?  @db.Text
  googleEventId String? // se sincronizado com Calendar
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  lead    Lead    @relation(fields: [leadId], references: [id])
  vehicle Vehicle? @relation(fields: [vehicleId], references: [id])
  sale    Sale?   @relation(fields: [saleId], references: [id])
  box     Box     @relation(fields: [boxId], references: [id])

  @@index([startsAt, status])
  @@index([leadId])
}
```

**Tools novas** (em `src/lib/tools.ts`):

- `buscar_janelas(serviceItemIds, periodo)` → lista slots livres considerando duração de cada serviço (`ServiceItem.duracaoMin`) + capacidade do `Box`. Sem Google Calendar inicialmente; só `Appointment` no banco.
- `agendar_visita(leadId, vehicleId, slot, serviceItemIds, observations)` → cria `Appointment` status `pending`. Confirmação por mensagem do lead → vira `confirmed`.
- `listar_agendamentos(leadId)` → mostra próximos do cliente.
- `cancelar_agendamento(appointmentId, motivo)`.
- `reagendar(appointmentId, novoSlot)`.

Integração Google Calendar: opcional na v1 (campos `Box.calendarId` e `Appointment.googleEventId` ficam null). Adicionar depois.

### Fase 6B — Lembrete pré-visita + No-show (médio impacto)

**Novas FollowUpRule**:

| tipo | gatilho | template |
|---|---|---|
| `lembrete_visita_d1` | `Appointment.startsAt - 1 dia` às 14h | "Oi {primeiro_nome}, lembrando da visita amanhã às {hora} no {box}. Confirma?" |
| `lembrete_visita_2h` | `Appointment.startsAt - 2 horas` | "Te esperamos em 2h. Endereço: {endereco}" |
| `no_show_d0` | `Appointment.status=no_show` (job marca após +2h) | "Vi que não conseguiu vir hoje. Tudo bem? Quer reagendar?" |
| `no_show_d3` | `no_show + 3 dias sem resposta` | "Conseguiu resolver? Posso encaixar em outro dia." |

Job adicional em `run-followups.ts`: detecta `Appointment.confirmed` cuja `startsAt + 2h < now` e ainda sem `done` → marca `no_show` + dispara mensagem.

### Fase 6C — 3-strike rule (alto impacto, baixo esforço)

Parar follow-ups infinitos. Adicionar `FollowUp.attempts` + lógica:

```ts
// followup-engine.ts
if (followUp.attempts >= 3) {
  // após 3 tentativas sem resposta:
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "PERDIDO" },
  });
  // mensagem de despedida cordial UMA VEZ:
  await sendDespedida(...)
  return;
}
```

Cada `FollowUpRule` pode ter `maxAttempts` próprio (default 3). Após N+1ª, em vez de retentar com mesmo template, dispara mensagem `<rule>_despedida`.

### Fase 6D — Agentes especializados por contexto (refator)

Hoje `generateAIResponse` usa um único system prompt. O template tem **4 agentes** com prompts ESPECÍFICOS:
- agente vendedor (atende mensagens novas)
- agente lembrete (envia lembrete)
- agente pós-consulta (NPS + retorno)
- agente follow-up (qualificado/no-show)

**Refator**: criar `src/lib/agents/` com `vendedor.ts`, `lembrete.ts`,
`pos-venda.ts`, `recuperacao.ts`. Cada um exporta `generate(ctx)`. O
roteador escolhe baseado no gatilho:
- mensagem nova → `vendedor`
- cron disparou follow-up → roteia por `FollowUpRule.tipo`

Vantagem: prompts mais focados = respostas melhores + menos tokens.

### Fase 6E — Reagir mensagem com emoji (baixo esforço, alto charme)

Tool nova `reagir(emoji)` que chama Evolution API endpoint
`/chat/sendReaction`. Max usa pra confirmar recebimento de áudio/imagem
ou marcar mensagem que vai responder depois (👀, ✅, 🔧).

### Fase 6F — Instagram Direct (médio impacto)

Adicionar `Instance.channel = "instagram"` (já existe) + webhook que
processa mensagens do Instagram Graph API. Mesmo `generateAIResponse`,
mesma `Lead.source = "instagram"` (já suportado). Só falta o webhook
endpoint.

### Fase 6G — Áudio resposta (ElevenLabs) (premium, baixa prioridade)

Quando cliente manda áudio, Max responde por áudio também (mais natural
no WhatsApp). Custo extra ElevenLabs por minuto. Postergar.

## Priorização

| Prioridade | Fase | Razão |
|---|---|---|
| 🔴 P1 | 6A (Agendamento) | Resolve queixa #1 do funil — Pneuzero perde venda quando Max não consegue agendar |
| 🔴 P1 | 6C (3-strike) | Sem isso, lead frio recebe spam infinito |
| 🟡 P2 | 6B (Lembrete D-1 + No-show) | Reduz no-show; melhora taxa de comparecimento |
| 🟡 P2 | 6D (Agentes especializados) | Qualidade da resposta; reduz custo OpenAI |
| 🟢 P3 | 6E (Reagir emoji) | Engajamento UX |
| 🟢 P3 | 6F (Instagram) | Quando Pneuzero pedir |
| 🔵 P4 | 6G (Áudio resposta) | Nice-to-have premium |

## O que NÃO copiar

- **Chatwoot como inbox** — temos Evolution direto + nosso painel; não vale trocar.
- **Estrutura de 9 sub-workflows n8n** — nosso código TS é mais manutenível que workflow visual fragmentado.
- **Hardcode "Maria Clínica Moreira"** — nosso `system_prompt` em Settings já é mais flexível.

## Decisão pendente do dono

1. Pneuzero usa Google Calendar pra agenda dos boxes? Se sim, integração 1ª classe. Se não, agenda interna no banco (mais simples).
2. Quantos boxes/atendimentos simultâneos a Pneuzero tem? Define schema da `Box.capacidade`.
3. Já existe Instagram Direct ativo na loja? Define se Fase 6F entra logo.
