-- Conversation: summary rolante + métricas
ALTER TABLE "Conversation"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "messagesSinceSummary" INTEGER NOT NULL DEFAULT 0;

-- LeadMemory: tsvector gerada (FTS em portuguese) + GIN index
ALTER TABLE "LeadMemory"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce("key", '') || ' ' || coalesce("value", ''))
  ) STORED;

CREATE INDEX "LeadMemory_search_vector_idx"
  ON "LeadMemory" USING GIN ("search_vector");

-- Message: tsvector gerada (corpo + transcrição) + GIN index
ALTER TABLE "Message"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce("body", '') || ' ' || coalesce("transcription", ''))
  ) STORED;

CREATE INDEX "Message_search_vector_idx"
  ON "Message" USING GIN ("search_vector");
