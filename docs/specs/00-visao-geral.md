# 00 — Visão geral

## Produto

**Assistente Max** — vendedor consultivo da Pneuzero Maranhão no WhatsApp. Atende leads, faz cotação consultiva (pneus + serviços), agenda visita, registra venda, cuida do pós-venda e follow-up automático.

## Atores

| Ator | Papel |
|------|-------|
| **Lead / Cliente** | Pessoa que manda mensagem no WhatsApp da Pneuzero |
| **Max (bot)** | IA atendendo via Evolution API + OpenAI |
| **Vendedor humano** | Funcionário Pneuzero que pega handoff e fecha venda |
| **Admin/Owner** | Configura prompt, base de conhecimento, regras follow-up |

## Jornada principal

```
Lead manda msg → Max responde, faz triagem (qtd pneus, ano carro)
              → Max envia checklist por idade + pede km
              → Max cota preço (montagem/balanceamento incluso)
              → Lead pergunta forma pagamento
              → Max passa para humano OU fecha direto se simples
              → Humano agenda visita → Lead vai na loja → Serviço executado
              → Sistema dispara NPS D+1
              → Sistema agenda follow-up rodízio (6m), alinhamento (3m), troca óleo (km), aniversário
```

## Métricas-alvo

| Métrica | Como medir |
|---------|------------|
| Taxa de qualificação | leads `QUALIFICADO+` ÷ leads `NOVO` |
| Taxa de fechamento | `Sale` ÷ `Quote` |
| Tempo médio resposta | média(`Message.createdAt` out − in) |
| NPS médio | média(`NPSResponse.nota`) últimos 90 dias |
| Recompra | clientes com ≥ 2 `Sale` |
| Resposta follow-up | leads que respondem ao follow-up ÷ enviados |

## Roadmap (5 fases)

| Fase | Entrega | Estimativa |
|------|---------|-----------|
| 1 | Limpeza resíduos Amo Vidas, prompt 100% Max, scraper site | 1-2 dias |
| 2 | Schema `Vehicle`/`Catalog`/`Quote`/`Sale`/`ServiceLog`, migration, seed | 2-3 dias |
| 3 | OpenAI tool-calling (cotar/agendar/registrar veículo), captura placa | 2-3 dias |
| 4 | Jobs follow-up (NPS, revisão, troca óleo, aniversário) + vendedor dono | 2 dias |
| 5 | Dashboard 360° (timeline cliente, veículos, vendas, NPS) | 2 dias |

Total: ~10 dias úteis.

## Fora de escopo (por enquanto)

- Multi-loja (multitenancy já está no schema, mas single-tenant na prática)
- Integração ERP/financeiro (Asaas já existe parcial)
- App mobile próprio
- E-commerce (compra online direta)
- Catálogo cliente final (loja virtual)
