-- Follow-up automático de silêncio (cliente parou de responder)
ALTER TABLE "Conversation"
  ADD COLUMN "silenceFollowupCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "silenceLastTryAt" TIMESTAMP(3),
  ADD COLUMN "silenceAbandonedAt" TIMESTAMP(3);

-- Index pra cron varrer conversas elegíveis rapidamente
CREATE INDEX "Conversation_silence_idx"
  ON "Conversation" ("silenceAbandonedAt", "silenceLastTryAt", "lastMessageAt")
  WHERE "silenceAbandonedAt" IS NULL;
