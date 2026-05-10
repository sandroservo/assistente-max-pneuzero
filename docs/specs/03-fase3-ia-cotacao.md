# Fase 3 — IA cotação consultiva (tool-calling)

Max passa de "fala bonito" para "fala bonito + cota de verdade + persiste".

## Tool-calling OpenAI

Migrar `openai.chat.completions.create` para passar `tools` e processar `tool_calls`.

### Tools a expor

#### `registrar_veiculo`

```json
{
  "name": "registrar_veiculo",
  "description": "Registra ou atualiza o veículo do lead quando ele informar placa, modelo, ano, km ou medida do pneu.",
  "parameters": {
    "type": "object",
    "properties": {
      "placa": { "type": "string" },
      "marca": { "type": "string" },
      "modelo": { "type": "string" },
      "ano": { "type": "integer" },
      "kmAtual": { "type": "integer" },
      "medidaPneu": { "type": "string", "description": "ex: 175/70R13" }
    }
  }
}
```

#### `buscar_pneu`

```json
{
  "name": "buscar_pneu",
  "description": "Busca pneus disponíveis por medida. Use ANTES de cotar preço de pneu.",
  "parameters": {
    "type": "object",
    "properties": {
      "medida": { "type": "string" },
      "marca": { "type": "string" }
    },
    "required": ["medida"]
  }
}
```

Retorna: `[{ id, marca, modelo, medida, preco, estoque }]`. Se vazio: Max informa "não temos essa medida em estoque" e oferece handoff humano.

#### `buscar_servico`

```json
{
  "name": "buscar_servico",
  "description": "Busca serviços do catálogo por categoria ou nome.",
  "parameters": {
    "type": "object",
    "properties": {
      "categoria": { "type": "string", "enum": ["alinhamento", "balanceamento", "suspensao", "freios", "oleo", "eletrica", "bateria"] },
      "termo": { "type": "string" }
    }
  }
}
```

#### `cotar`

```json
{
  "name": "cotar",
  "description": "Cria uma cotação (Quote) para o lead com itens (pneus + serviços). Use quando o cliente já tiver medido pneu + serviços decididos.",
  "parameters": {
    "type": "object",
    "properties": {
      "itens": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "tipo": { "type": "string", "enum": ["tire", "service"] },
            "tireId": { "type": "string" },
            "serviceItemId": { "type": "string" },
            "quantidade": { "type": "integer" }
          }
        }
      },
      "formaPagamento": { "type": "string" },
      "observacoes": { "type": "string" }
    },
    "required": ["itens"]
  }
}
```

Retorna: `{ quoteId, total, items[] }`. Max formata como mensagem WhatsApp.

#### `agendar_visita`

```json
{
  "name": "agendar_visita",
  "description": "Pré-agenda uma visita do cliente à loja. Cria Sale com status AGENDADA vinculada à cotação.",
  "parameters": {
    "type": "object",
    "properties": {
      "quoteId": { "type": "string" },
      "data": { "type": "string", "format": "date-time" }
    },
    "required": ["quoteId", "data"]
  }
}
```

#### `transferir_humano`

```json
{
  "name": "transferir_humano",
  "description": "Cria handoff para vendedor humano. Use quando lead pede atendente, quando cotação está pronta para fechamento, ou quando há dúvida técnica complexa.",
  "parameters": {
    "type": "object",
    "properties": {
      "motivo": { "type": "string" },
      "resumo": { "type": "string" }
    },
    "required": ["motivo"]
  }
}
```

## Captura automática de dados

### Placa (regex)

- Antigo: `[A-Z]{3}-?\d{4}`
- Mercosul: `[A-Z]{3}\d[A-Z]\d{2}`

Combinado: `\b[A-Z]{3}-?\d[A-Z\d]\d{2}\b`

Toda mensagem in passa por extrator. Se encontrar placa, chama `registrar_veiculo` automaticamente (sem precisar do tool-call do modelo).

### Medida de pneu (regex)

`\b\d{3}\/\d{2}\s?R?\d{2}\b` → ex: `175/70R13`, `205/55 17`

### Km

`\b\d{1,3}\.?\d{3}\s?(km|quilômetros?|quilometros?)\b`

## Fluxo simplificado

```
1. Webhook recebe msg
2. Salva Message no banco
3. Extratores rodam (placa, medida, km) → upsert Vehicle se achou
4. generateAIResponse() monta prompt + tools + histórico
5. OpenAI responde:
   - texto: envia ao cliente
   - tool_call: executa tool, envia resultado de volta, repete até resposta texto
6. Salva Message out
7. detectLeadStatus() → atualiza Lead.status
8. Verifica se precisa criar Follow-up
```

## Garantias

- **Preço nunca inventado** — Max só fala preço se vier de `buscar_pneu`/`buscar_servico`. Sem tool-call, sem preço.
- **Cotação imutável** — `QuoteItem.precoUnit` é snapshot. Se preço do produto mudar depois, cotação antiga não muda.
- **Validade** — `Quote.validadeAte` default = `now() + 7 dias`. Após isso, status = `EXPIRADA`.

## Critério de aceite

- [ ] Conversa de teste: "Quero pneu 175/70R13" → Max chama `buscar_pneu`, lista opções com preço real do banco
- [ ] "Quero 4 desses + alinhamento e balanceamento" → Max chama `cotar`, cria `Quote` no banco, formata mensagem WhatsApp com total
- [ ] Cliente manda placa "ABC1D23" → `Vehicle` criado/atualizado sem precisar de tool-call
- [ ] Max nunca cita preço fora do retorno de tool — testar pedindo "quanto é o pneu" sem medida (Max deve pedir medida primeiro)
- [ ] Handoff: cliente fala "quero fechar" → Max chama `transferir_humano` e responde frase de transição
