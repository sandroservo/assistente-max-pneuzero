# Fase 4 — Pós-venda + follow-up automático

Sistema dispara mensagens sozinho com base em regras e histórico do veículo.

## Atribuição de venda

**Regra fixa**: quem fez o handoff vira `vendedorId` da `Sale`.

- Quando `Handoff` é criado e atendente clica "Pegar atendimento", `Handoff.assignedToId` é setado.
- Toda `Sale` criada **enquanto há handoff aberto** dessa conversa herda `assignedToId` como `vendedorId`.
- Se bot fechou (sem handoff humano), `vendedorId` = user especial `bot@pneuzero.local` (criado no seed).

## Job scheduler

`scripts/run-followups.ts` rodando via cron (a cada 10min). Lógica:

```ts
1. Busca FollowUp pendente com scheduledAt <= now()
2. Para cada um:
   a. Carrega rule (FollowUpRule)
   b. Renderiza template com vars do lead/veículo/sale
   c. Envia via Evolution API
   d. Marca como "sent"
   e. Cria Message out no banco
3. Roda gerador de novos FollowUps:
   - Sale.status virou CONCLUIDA agora? → cria FollowUp NPS D+1
   - ServiceLog tipo "alinhamento" criado? → cria FollowUp 90 dias
   - ServiceLog tipo "troca_oleo" criado? → calcula próxima troca por km
   - Lead.birthDate hoje? → cria FollowUp aniversário
   - Lead status NOVO há 3 dias sem responder? → cria FollowUp lead frio
```

## Regras default

Ver [follow-up-rules.md](follow-up-rules.md) para templates completos.

| Tipo | Gatilho | Quando enviar | Template (resumo) |
|------|---------|---------------|-------------------|
| `nps_d1` | `Sale.status = CONCLUIDA` | D+1 das 14h | "Como foi atendimento? Nota 0-10" |
| `alinhamento_3m` | `ServiceLog.tipo = alinhamento` | +90 dias | "Já tá na hora de alinhar de novo. Agenda?" |
| `rodizio_6m` | `ServiceLog.tipo = troca_pneu` | +180 dias | "Hora do rodízio dos pneus." |
| `troca_oleo_km` | `ServiceLog.tipo = troca_oleo` | Quando km estimado atingir +5.000 do último | "Faz X km da última troca de óleo." |
| `aniversario` | `Lead.birthDate` mês/dia bate | 9h do dia | "Feliz aniversário! Cupom 10% balanceamento." |
| `lead_frio_3d` | `Lead.status = NOVO`, sem msg in há 3 dias | D+3 | "Ainda precisa daquele pneu?" |
| `lead_frio_15d` | Lead `LEAD_FRIO` | D+15 | Reativação suave |

## Captura NPS

Cliente responde número 0-10 ao prompt NPS → parser extrai nota:

```ts
const ratingRegex = /\b(10|[0-9])\b/;
```

Se mensagem in vem de Lead com `NPSResponse` pendente (Sale concluída últimos 7 dias, sem `NPSResponse`):
1. Extrai nota
2. Cria `NPSResponse`
3. Pede comentário se nota ≤ 7 ("o que poderia ter sido melhor?")
4. Promotor (9-10): pede review Google
5. Detrator (0-6): aciona handoff automático para gerência

## Templates com variáveis

Suportar `{{nome}}`, `{{primeiro_nome}}`, `{{veiculo_modelo}}`, `{{veiculo_placa}}`, `{{ultimo_servico}}`, `{{dias_atras}}`, `{{cupom}}`.

```ts
function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
```

## Pausa de follow-up

Lead pode pedir "para de me mandar mensagem" → flag `Lead.followUpOptOut = true`. Job pula leads com flag. Adicionar coluna na migration.

## Critério de aceite

- [ ] Sale concluída cria FollowUp NPS automático para D+1
- [ ] Job processa follow-ups pendentes e envia via Evolution
- [ ] Cliente responde "10" → `NPSResponse` salva categoria=promotor, dispara mensagem agradecimento + link Google
- [ ] Cliente responde "5" → categoria=detrator, cria `Handoff` automático para gerente
- [ ] Lead frio recebe mensagem D+3 se não respondeu
- [ ] Aniversário dispara 9h do dia (testar via mock date)
- [ ] Opt-out: lead com `followUpOptOut=true` é pulado
- [ ] Mensagem follow-up aparece na conversa do dashboard
