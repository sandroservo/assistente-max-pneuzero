# Fase 5 — Dashboard 360°

UI completa do cliente. Vendedor abre a ficha e vê tudo.

## Telas

### `/leads/[id]` — Ficha 360°

Layout:

```
┌─────────────────────────────────────────────────────────┐
│ [Avatar] Nome do Lead          [Status: QUALIFICADO]    │
│ Telefone · Email · Cidade · Aniversário                 │
│ Vendedor responsável: Fulano                            │
│ [Tags]                                                  │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Timeline] [Veículos] [Vendas] [NPS] [Follow-ups] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TIMELINE (agregada, ordem cronológica)                 │
│  ──────────────────────────────────────                 │
│  📱 [Mensagem in] "Quero trocar 4 pneus"   há 2h        │
│  🤖 [Max] "Beleza! Me passa medida..."     há 2h        │
│  📋 [Cotação] R$ 1.480,00 — 4× P1 + alinh  há 1h        │
│  💰 [Venda] R$ 1.480,00 — Fulano vendedor  hoje 14h     │
│  🔧 [Serviço] Troca 4 pneus + alinhamento  hoje 16h     │
│  ⭐ [NPS] 10 — "Atendimento ótimo!"        amanhã        │
│  🔔 [Follow-up agendado] Alinhamento 90d   em 90d       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tab Veículos

Lista de `Vehicle` do lead. Card por veículo:

```
┌───────────────────────────────┐
│ 🚗 Fiat Strada 2018           │
│    Placa ABC-1D23             │
│    Pneu 175/70R13 · 45.000 km │
│    Última troca pneus: 6m     │
│    Último alinhamento: 3m     │
│    Próxima troca óleo: ~500km │
│    [Editar] [Histórico]       │
└───────────────────────────────┘
```

### Tab Vendas

Tabela: data, total, vendedor, status, ações (ver detalhe, gerar segunda via).

### Tab NPS

Cards com nota, comentário, data, sale relacionada.

### Tab Follow-ups

- Próximos (status pending) com data
- Histórico (status sent) com mensagem enviada e resposta do cliente
- Botão "Criar follow-up manual"

## Outras telas

### `/dashboard` — Home

KPIs principais:
- Leads novos hoje
- Cotações abertas
- Vendas mês (R$ + qtd)
- NPS mês
- Top vendedores
- Funil (NOVO → QUALIFICADO → FECHADO)

### `/catalog` — Catálogo

CRUD `TireProduct`, `ServiceItem`, `ServiceCategory`. Importar JSON do scraper.

### `/follow-up-rules` — Regras

CRUD `FollowUpRule`. Editar template, ativar/desativar.

### `/sales` — Lista vendas

Filtros: período, vendedor, status. Exportar CSV.

### `/reports` — Relatórios

- NPS por vendedor
- Faturamento por categoria de serviço
- Pneus mais vendidos (marca/medida)
- Taxa conversão por origem (WhatsApp, Instagram, manual)
- Recompra (clientes 2+ vendas)

## Componentes-chave a criar

- `<VehicleCard>` — card do veículo
- `<Timeline>` — timeline agregada (recebe items heterogêneos)
- `<QuoteDetail>` — detalhe cotação (PDF/print)
- `<NPSCard>` — card de NPS com cor por categoria
- `<FollowUpComposer>` — criar follow-up manual

## Critério de aceite

- [ ] `/leads/[id]` mostra timeline ordenada com todos os eventos
- [ ] Tab Veículos mostra todos os veículos do lead com info correta
- [ ] Tab Vendas mostra histórico com vendedor responsável
- [ ] Tab NPS exibe notas e comentários, com cor (verde/amarelo/vermelho)
- [ ] Tab Follow-ups mostra agendados e histórico
- [ ] Criar follow-up manual funciona
- [ ] Dashboard home com KPIs reais (não mock)
- [ ] Catálogo permite editar produtos
- [ ] Acessibilidade básica: foco, labels, contraste
