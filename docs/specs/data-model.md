# Data model — schema completo proposto

Mapa de todas as tabelas após Fase 2. Use como referência rápida.

## Diagrama (texto)

```
Organization 1───* User
Organization 1───* Instance
Organization 1───* Lead
Organization 1───* Knowledge
Organization 1───* FollowUpRule
Organization 1───* ExcludedContact
Organization 1───* Tag

Lead 1───* Vehicle
Lead 1───* Conversation
Lead 1───* Quote
Lead 1───* Sale
Lead 1───* NPSResponse
Lead 1───* FollowUp
Lead 1───* LeadMemory
Lead *───* Tag

Vehicle 1───* Quote
Vehicle 1───* Sale
Vehicle 1───* ServiceLog

Conversation 1───* Message
Conversation 1───* Handoff

Quote 1───* QuoteItem
Quote 1───0..1 Sale

Sale 1───* ServiceLog
Sale 1───0..1 NPSResponse

User (vendedor) 1───* Quote
User (vendedor) 1───* Sale
User 1───* Handoff (assignedTo)
User 1───* Message (sentByUser)

ServiceCategory 1───* ServiceItem
ServiceItem 1───* QuoteItem
TireProduct 1───* QuoteItem
```

## Tabelas — visão tabela

| Tabela | Propósito | Append-only? |
|--------|-----------|--------------|
| `Organization` | Tenant | não |
| `User` | Funcionário (vendedor/admin) | não |
| `Instance` | WhatsApp conectado | não |
| `OrgSettings` | Config tenant (chave/valor) | não |
| `ExcludedContact` | Números que Max não responde | não |
| `Lead` | Cliente/prospect | não (status muda) |
| `LeadMemory` | Memória extraída pela IA | não |
| `Tag` | Etiqueta lead | não |
| `Vehicle` | Carro do lead | não (km atualiza) |
| `Conversation` | Linha temporal WhatsApp | não |
| `Message` | Mensagem WhatsApp | **sim** |
| `Handoff` | Transferência para humano | não |
| `Knowledge` | Base conhecimento RAG | não |
| `ServiceCategory` | Categoria serviço | não |
| `ServiceItem` | Serviço catálogo | não |
| `TireProduct` | Pneu catálogo | não |
| `Quote` | Orçamento | parcial (status muda) |
| `QuoteItem` | Item do orçamento | **sim** (snapshot) |
| `Sale` | Venda fechada | parcial |
| `ServiceLog` | Serviço executado | **sim** |
| `NPSResponse` | Pesquisa pós-venda | **sim** |
| `FollowUpRule` | Regra disparo follow-up | não |
| `FollowUp` | Follow-up agendado/enviado | parcial |
| `AsaasWebhookLog` | Auditoria webhook | **sim** |
| `Settings` | Config global (legacy) | não |
| `SavedContact` | Contato salvo (legacy) | não |

## Convenções

- **IDs**: `cuid()` (não autoincrement). Bom para distribuído.
- **Timestamps**: sempre `createdAt` + `updatedAt` (exceto append-only que só tem `createdAt`).
- **Dinheiro**: `Decimal(10,2)`, nunca `Float`. Armazenar em reais.
- **Datas de evento**: `DateTime` em UTC. UI converte para Brasília.
- **Soft delete**: NÃO usar. Se precisar arquivar, usar `ativo Boolean`.
- **Snapshots em itens de venda**: `QuoteItem.descricao` e `precoUnit` são snapshot — preservar histórico mesmo se produto mudar.
- **Multi-tenant**: toda tabela "raiz" tem `organizationId`. Tabelas filhas herdam pelo pai (não duplicar FK).

## Índices críticos

| Tabela | Índice | Por quê |
|--------|--------|---------|
| `Lead` | `(organizationId, phone)` unique | busca rápida por telefone vindo do webhook |
| `Vehicle` | `placa` | busca rápida ao receber placa |
| `TireProduct` | `medida` | tool `buscar_pneu` |
| `Message` | `(conversationId, createdAt)` | timeline |
| `FollowUp` | `(status, scheduledAt)` | job scheduler |
| `Sale` | `vendedorId`, `dataFechamento` | relatórios |
| `NPSResponse` | `nota` | filtro detrator/promotor |

## Volume estimado (12 meses)

| Tabela | Linhas/mês | Total 12m |
|--------|-----------|-----------|
| Lead | ~500 | 6.000 |
| Conversation | ~500 | 6.000 |
| Message | ~30.000 | 360.000 |
| Quote | ~300 | 3.600 |
| Sale | ~150 | 1.800 |
| ServiceLog | ~300 | 3.600 |
| FollowUp | ~1.000 | 12.000 |

Postgres aguenta tranquilo. Sem necessidade de partição.

## Backup

- `pg_dump` diário.
- Mídia (áudio, imagem) em storage externo (não no banco).
- Retenção: 90 dias backup diário, 12m mensal.
