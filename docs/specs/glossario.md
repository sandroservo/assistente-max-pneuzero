# Glossário

Termos do domínio Pneuzero / Max.

## Negócio

| Termo | Significado |
|-------|-------------|
| **Pneuzero** | Loja Pneuzero Maranhão — cliente principal do projeto |
| **Max** | Bot/atendente IA da Pneuzero (substitui "Vi" do projeto antigo) |
| **Lead** | Pessoa que mandou mensagem mas ainda não comprou |
| **Cliente** | Lead que já tem pelo menos 1 `Sale` |
| **Veículo** | Carro do lead — placa, modelo, ano, km, pneu |
| **Cotação (Quote)** | Orçamento enviado, ainda não fechado |
| **Venda (Sale)** | Cotação fechada — cliente confirmou e/ou pagou |
| **Serviço executado (ServiceLog)** | Trabalho de fato feito no carro |
| **Handoff** | Transferência de conversa do bot para humano |
| **NPS** | Net Promoter Score 0-10. ≤6 detrator, 7-8 neutro, 9-10 promotor |
| **Vendedor** | User humano dono da venda (quem fez handoff) |

## Pneus

| Termo | Significado |
|-------|-------------|
| **Medida** | Padrão tipo `175/70R13` (largura/perfil + R + aro) |
| **Aro** | Diâmetro da roda em polegadas (13, 14, 15, 16, 17...) |
| **Perfil** | Altura da lateral em % da largura |
| **Carga** | Capacidade de peso (índice numérico) |
| **Velocidade** | Limite velocidade (letra: T=190, H=210, V=240) |
| **Composição** | Quantidade de pneus que o cliente vai trocar (1, 2 ou 4) |

## Serviços

| Termo | Significado |
|-------|-------------|
| **Alinhamento** | Ajuste ângulos das rodas (camber, caster, toe) |
| **Balanceamento** | Equilibra peso da roda + pneu |
| **Rodízio** | Trocar posição dos pneus para desgaste uniforme (a cada 6m) |
| **Geometria 3D** | Alinhamento computadorizado |
| **Suspensão** | Amortecedores, molas, batentes, buchas, bieletas |
| **Bicos** | Bicos das válvulas (geralmente brindes na troca de pneu) |
| **Montagem** | Colocar pneu na roda (em geral grátis na compra) |

## Status do lead (fluxo)

```
NOVO → EM_ATENDIMENTO → CONSCIENTIZADO → QUALIFICADO
                                          ↓
                               PROPOSTA_ENVIADA → EM_NEGOCIACAO
                                          ↓
                                     AGUARDANDO_RESPOSTA
                                          ↓
                                FECHADO | PERDIDO | LEAD_FRIO

Em paralelo: HUMANO_SOLICITADO → HUMANO_EM_ATENDIMENTO
```

## Status da cotação

```
ABERTA → ENVIADA → ACEITA → CONVERTIDA (vira Sale)
                  → RECUSADA
                  → EXPIRADA (passou validade)
```

## Status da venda

```
AGENDADA → EM_EXECUCAO → CONCLUIDA
        → CANCELADA
```

## Categorias de follow-up

| Tipo | Quando |
|------|--------|
| `nps_d1` | D+1 após `Sale.CONCLUIDA` |
| `alinhamento_3m` | +90 dias do último alinhamento |
| `rodizio_6m` | +180 dias da troca de pneus |
| `troca_oleo_km` | Próximo km estimado da troca |
| `aniversario` | Dia do `Lead.birthDate` |
| `lead_frio_3d` | 3 dias sem responder |
| `lead_frio_15d` | 15 dias em `LEAD_FRIO` |
| `garantia_vencendo` | -7 dias antes garantia vencer |

## Stack técnica

| Termo | Significado |
|-------|-------------|
| **Evolution API** | Cliente WhatsApp não-oficial (webhook) |
| **Whisper** | Modelo OpenAI transcrição áudio |
| **Vision (gpt-4o-mini)** | Modelo OpenAI descrição imagem |
| **Tool-calling** | Function calling do OpenAI — IA chama funções estruturadas |
| **RAG** | Retrieval-Augmented Generation — base de conhecimento injetada no prompt |
| **Handoff** | Padrão de transferir conversa do bot para humano |
| **Multi-tenant** | Suporte a múltiplas organizações (mesmo código serve várias lojas) |
