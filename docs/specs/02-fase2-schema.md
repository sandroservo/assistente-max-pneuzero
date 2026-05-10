# Fase 2 — Schema 360° cliente + veículo

Adicionar modelos que faltam para perfil completo e cotação estruturada.

## Modelos novos

### `Vehicle` — veículo do lead

Lead pode ter N veículos. Centro do follow-up por km/idade.

```prisma
model Vehicle {
  id              String   @id @default(cuid())
  leadId          String
  placa           String?  // AAA1A23 (Mercosul) ou AAA1234
  marca           String?  // Fiat, VW, Toyota
  modelo          String?  // Strada, Gol, Corolla
  ano             Int?
  cor             String?
  medidaPneu      String?  // 175/70R13
  kmAtual         Int?
  kmEstimadoMes   Int?     // para calcular próxima troca óleo
  ultimaTrocaOleoKm     Int?
  ultimaTrocaOleoData   DateTime?
  ultimoAlinhamentoData DateTime?
  ultimoBalanceamentoData DateTime?
  ultimaTrocaPneusData  DateTime?
  observacoes     String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  lead         Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  quotes       Quote[]
  sales        Sale[]
  serviceLogs  ServiceLog[]

  @@index([leadId])
  @@index([placa])
}
```

### `ServiceCategory` + `ServiceItem` — catálogo de serviços

```prisma
model ServiceCategory {
  id    String @id @default(cuid())
  nome  String @unique  // "Alinhamento", "Suspensão", "Freios", "Óleo", "Elétrica", "Bateria"
  icone String?
  items ServiceItem[]
}

model ServiceItem {
  id            String   @id @default(cuid())
  categoryId    String
  nome          String   // "Alinhamento direção 3D"
  descricao     String?  @db.Text
  precoBase     Decimal? @db.Decimal(10,2)
  garantiaDias  Int?     // 30, 90, 180
  duracaoMin    Int?     // tempo médio execução
  ativo         Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  category    ServiceCategory @relation(fields: [categoryId], references: [id])
  quoteItems  QuoteItem[]

  @@index([categoryId])
  @@index([ativo])
}
```

### `TireProduct` — catálogo de pneus

```prisma
model TireProduct {
  id        String   @id @default(cuid())
  marca     String   // Pirelli, Michelin, Goodyear, Continental
  modelo    String   // Cinturato P1, Energy XM2
  medida    String   // 175/70R13
  aro       Int      // 13, 14, 15...
  uso       String?  // passeio, SUV, caminhonete
  preco     Decimal? @db.Decimal(10,2)
  estoque   Int      @default(0)
  ativo     Boolean  @default(true)
  imagem    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quoteItems QuoteItem[]

  @@unique([marca, modelo, medida])
  @@index([medida])
  @@index([aro])
  @@index([ativo])
}
```

### `Quote` + `QuoteItem` — orçamento

```prisma
model Quote {
  id              String      @id @default(cuid())
  organizationId  String
  leadId          String
  vehicleId       String?
  conversationId  String?
  vendedorId      String?     // User (humano) ou null se bot
  status          QuoteStatus @default(ABERTA)
  subtotal        Decimal     @db.Decimal(10,2)
  desconto        Decimal     @default(0) @db.Decimal(10,2)
  total           Decimal     @db.Decimal(10,2)
  formaPagamento  String?     // pix, dinheiro, cartao_vista, cartao_parcelado
  parcelas        Int?
  observacoes     String?     @db.Text
  validadeAte     DateTime?
  enviadaEm       DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  lead     Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  vehicle  Vehicle?     @relation(fields: [vehicleId], references: [id])
  vendedor User?        @relation("VendedorQuote", fields: [vendedorId], references: [id])
  items    QuoteItem[]
  sale     Sale?

  @@index([leadId])
  @@index([vendedorId])
  @@index([status])
}

enum QuoteStatus {
  ABERTA
  ENVIADA
  ACEITA
  RECUSADA
  EXPIRADA
  CONVERTIDA
}

model QuoteItem {
  id            String   @id @default(cuid())
  quoteId       String
  tipo          String   // "tire" | "service"
  tireId        String?
  serviceItemId String?
  descricao     String   // snapshot (caso preço mude depois)
  quantidade    Int      @default(1)
  precoUnit     Decimal  @db.Decimal(10,2)
  subtotal      Decimal  @db.Decimal(10,2)

  quote       Quote        @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  tire        TireProduct? @relation(fields: [tireId], references: [id])
  serviceItem ServiceItem? @relation(fields: [serviceItemId], references: [id])

  @@index([quoteId])
}
```

### `Sale` — venda fechada

```prisma
model Sale {
  id              String   @id @default(cuid())
  organizationId  String
  quoteId         String   @unique
  leadId          String
  vehicleId       String?
  vendedorId      String   // SEMPRE preenchido — quem fechou
  total           Decimal  @db.Decimal(10,2)
  formaPagamento  String
  parcelas        Int?
  dataFechamento  DateTime @default(now())
  dataServico     DateTime?  // quando vai/foi executado
  status          SaleStatus @default(AGENDADA)
  notaFiscal      String?
  observacoes     String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  quote       Quote        @relation(fields: [quoteId], references: [id])
  lead        Lead         @relation(fields: [leadId], references: [id])
  vehicle     Vehicle?     @relation(fields: [vehicleId], references: [id])
  vendedor    User         @relation("VendedorSale", fields: [vendedorId], references: [id])
  serviceLogs ServiceLog[]
  nps         NPSResponse?

  @@index([leadId])
  @@index([vendedorId])
  @@index([status])
  @@index([dataFechamento])
}

enum SaleStatus {
  AGENDADA
  EM_EXECUCAO
  CONCLUIDA
  CANCELADA
}
```

### `ServiceLog` — histórico de serviço executado

Append-only. Base para follow-up por km/idade.

```prisma
model ServiceLog {
  id            String   @id @default(cuid())
  vehicleId     String
  saleId        String?
  tipo          String   // "alinhamento" | "balanceamento" | "troca_oleo" | "troca_pneu" | "freios" | ...
  descricao     String?  @db.Text
  kmNoServico   Int?
  executadoEm   DateTime @default(now())
  garantiaAte   DateTime?
  pecasUsadas   String?  @db.Text  // JSON
  createdAt     DateTime @default(now())

  vehicle Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  sale    Sale?   @relation(fields: [saleId], references: [id])

  @@index([vehicleId])
  @@index([tipo])
  @@index([executadoEm])
}
```

### `NPSResponse` — pesquisa pós-venda

```prisma
model NPSResponse {
  id          String   @id @default(cuid())
  saleId      String   @unique
  leadId      String
  nota        Int      // 0-10
  categoria   String   // detrator | neutro | promotor
  comentario  String?  @db.Text
  respondidoEm DateTime @default(now())

  sale Sale @relation(fields: [saleId], references: [id])
  lead Lead @relation(fields: [leadId], references: [id])

  @@index([leadId])
  @@index([nota])
}
```

### `FollowUpRule` — regras de follow-up (config)

```prisma
model FollowUpRule {
  id              String   @id @default(cuid())
  organizationId  String
  tipo            String   // "nps_d1" | "alinhamento_3m" | "rodizio_6m" | "troca_oleo_km" | "aniversario" | "lead_frio_3d"
  nome            String
  ativo           Boolean  @default(true)
  gatilho         String   @db.Text  // JSON: { "evento": "sale.concluida", "delayDias": 1 }
  template        String   @db.Text  // mensagem (pode ter {{nome}}, {{veiculo}})
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([tipo])
}
```

## Alterações nos modelos existentes

### `Lead`

- Adicionar `cpf String?` (opcional, p/ nota fiscal)
- `birthDate` já existe ✅
- `vehicles Vehicle[]`, `quotes Quote[]`, `sales Sale[]`, `nps NPSResponse[]`

### `FollowUp`

Adicionar contexto:
- `type String` ("nps_d1", "alinhamento_3m", "rodizio_6m", "troca_oleo", "aniversario", "lead_frio")
- `vehicleId String?`
- `saleId String?`
- `serviceLogId String?`
- `ruleId String?` (qual `FollowUpRule` originou)
- `template String?` (snapshot template usado)

### `User`

- Relations `vendedorQuotes Quote[] @relation("VendedorQuote")`
- `vendedorSales Sale[] @relation("VendedorSale")`

## Migration

```bash
npx prisma migrate dev --name fase2_360_cliente_veiculo
```

## Seeds necessárias

- `scripts/seed-catalog.ts` — popula `ServiceCategory`, `ServiceItem`, `TireProduct` a partir de `agent/pneuzero-catalog.json` (saída do scraper).
- `scripts/seed-followup-rules.ts` — popula `FollowUpRule` com regras default (ver [follow-up-rules.md](follow-up-rules.md)).

## Critério de aceite

- [ ] Migration aplicada sem erro
- [ ] `npx prisma studio` mostra todas as tabelas novas
- [ ] Seed catálogo roda e popula `TireProduct` + `ServiceItem`
- [ ] Seed follow-up rules cria as 5+ regras default
- [ ] Tipos Prisma gerados (`@prisma/client`) compilam no projeto
- [ ] Nenhuma quebra no webhook (testar conversa real)
