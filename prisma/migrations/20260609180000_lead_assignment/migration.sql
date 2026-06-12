-- Lead.assignedUserId + assignedAt — fila de atendimento (vendedor responsável)
ALTER TABLE "Lead"
  ADD COLUMN "assignedUserId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");
