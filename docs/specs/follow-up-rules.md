# Regras de follow-up — templates e gatilhos

Regras default que vão para `seed-followup-rules.ts`. Editáveis no painel (Fase 5).

## Convenções

- `delayDias` — quantos dias após o gatilho (negativo = antes)
- `horarioEnvio` — hora local Brasília. Job só envia dentro de janela 8h-20h.
- `naoEnviarEm` — dias da semana a pular (ex.: domingo).
- Variáveis: `{{primeiro_nome}}`, `{{veiculo_modelo}}`, `{{veiculo_placa}}`, `{{dias_atras}}`, `{{ultimo_servico}}`, `{{cupom}}`, `{{loja_endereco}}`.

## Regras

### 1. NPS D+1

```json
{
  "tipo": "nps_d1",
  "nome": "Pesquisa NPS pós-venda",
  "gatilho": { "evento": "sale.concluida", "delayDias": 1, "horarioEnvio": "14:00" },
  "template": "Oi {{primeiro_nome}}! Aqui é o Max da Pneuzero. Ontem você passou aqui pra fazer {{ultimo_servico}} no {{veiculo_modelo}} 🚗\n\nDe 0 a 10, quanto você indicaria a gente pra um amigo?"
}
```

Resposta esperada: número 0-10. Parser extrai nota.

- **9-10 (promotor)**: agradece + pede review Google.
- **7-8 (neutro)**: agradece + pede sugestão.
- **0-6 (detrator)**: pede comentário + cria handoff automático para gerente.

### 2. Alinhamento 90 dias

```json
{
  "tipo": "alinhamento_3m",
  "nome": "Lembrete alinhamento 90 dias",
  "gatilho": { "evento": "servicelog.tipo=alinhamento", "delayDias": 90, "horarioEnvio": "10:00" },
  "template": "{{primeiro_nome}}, faz 90 dias que você alinhou o {{veiculo_modelo}} aqui na Pneuzero 🛠️\n\nJá tá no momento de uma checagem rápida. Quer que eu agende uma avaliação gratuita?"
}
```

### 3. Rodízio 180 dias

```json
{
  "tipo": "rodizio_6m",
  "nome": "Lembrete rodízio pneus 6 meses",
  "gatilho": { "evento": "servicelog.tipo=troca_pneu", "delayDias": 180, "horarioEnvio": "10:00" },
  "template": "Opa {{primeiro_nome}}! Faz 6 meses que você trocou os pneus do {{veiculo_modelo}}. Já tá no ponto de fazer o rodízio pra eles durarem mais 🔄\n\nO rodízio é rapidinho, posso encaixar pra essa semana?"
}
```

### 4. Troca óleo por km

```json
{
  "tipo": "troca_oleo_km",
  "nome": "Lembrete troca óleo (km estimado)",
  "gatilho": { "evento": "km.atingiu_proxima_troca", "horarioEnvio": "11:00" },
  "template": "{{primeiro_nome}}, pela média que você roda, o {{veiculo_modelo}} já tá perto dos {{km_estimado}} km da última troca de óleo 🛢️\n\nQuer que eu agende a próxima trocada com a gente? Inclui filtro também."
}
```

**Cálculo do gatilho**:
- `Vehicle.ultimaTrocaOleoKm` + `5.000` = próxima troca (default; ajustável por modelo).
- Job soma `Vehicle.kmEstimadoMes × meses desde última troca` ao km da última troca.
- Quando >= próxima, dispara.

### 5. Aniversário

```json
{
  "tipo": "aniversario",
  "nome": "Aniversário do cliente",
  "gatilho": { "evento": "lead.birthday", "horarioEnvio": "09:00" },
  "template": "Feliz aniversário, {{primeiro_nome}}! 🎂 Te desejamos um ano cheio de saúde e estrada boa.\n\nA Pneuzero tem um presentinho: 10% off em alinhamento ou balanceamento esse mês. Cupom: {{cupom}}\n\nUm abraço da equipe! 🚗"
}
```

`{{cupom}}` gerado dinamicamente: `ANIV-{{primeiro_nome_upper}}-MM`.

### 6. Lead frio D+3

```json
{
  "tipo": "lead_frio_3d",
  "nome": "Reativação lead sem resposta 3 dias",
  "gatilho": { "evento": "lead.sem_resposta", "delayDias": 3, "horarioEnvio": "11:00" },
  "template": "Oi {{primeiro_nome}}! Aqui é o Max. Vi que conversamos uns dias atrás sobre pneu pro seu carro 🚗\n\nAinda tá precisando? Se quiser, posso reservar uma avaliação gratuita aqui na loja. Sem compromisso!"
}
```

### 7. Reativação D+15

```json
{
  "tipo": "lead_frio_15d",
  "nome": "Reativação lead frio 15 dias",
  "gatilho": { "evento": "lead.status=LEAD_FRIO", "delayDias": 15, "horarioEnvio": "16:00" },
  "template": "{{primeiro_nome}}, passando rapidinho! Surgiu uma condição boa esse mês em alinhamento + balanceamento + rodízio: pacote completo por preço de promoção.\n\nQuer que eu te envie os detalhes? 🛠️"
}
```

### 8. Garantia vencendo

```json
{
  "tipo": "garantia_vencendo",
  "nome": "Aviso garantia próxima vencer",
  "gatilho": { "evento": "servicelog.garantia_ate", "delayDias": -7 },
  "template": "{{primeiro_nome}}, a garantia do serviço de {{ultimo_servico}} no {{veiculo_modelo}} vence em 7 dias.\n\nSe sentir algo estranho, passa aqui pra gente avaliar — ainda dá tempo de cobrir pela garantia 🛡️"
}
```

## Anti-spam

- Máximo 1 follow-up por lead por dia (job consolida).
- Se lead respondeu mensagem nas últimas 24h, **não** envia follow-up automático (esperar conversa fluir).
- `Lead.followUpOptOut = true` → pula tudo.
- Detector de palavras: "para de me mandar", "remove meu número", "não quero mais" → seta opt-out automático.

## Métricas

- Taxa de resposta por tipo
- Taxa de conversão (NPS, agendamento)
- Reclamações sobre frequência

Revisar mensalmente. Templates podem ser AB-testados (campo `versao` em `FollowUpRule`).
