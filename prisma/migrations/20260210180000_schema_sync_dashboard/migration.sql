-- Sync database with prisma/schema.prisma (Lead, Message, enums, Tag, SavedContact, AsaasWebhookLog)

-- AlterEnum (PostgreSQL 12+; multiple values in one migration — OK on PG 16)
ALTER TYPE "LeadStatus" ADD VALUE 'CONSCIENTIZADO';
ALTER TYPE "LeadStatus" ADD VALUE 'LEAD_FRIO';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'geral',
ADD COLUMN     "leadScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'whatsapp';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "quotedMessageId" TEXT,
ADD COLUMN     "quotedProviderId" TEXT,
ADD COLUMN     "sentByUserId" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "transcription" TEXT;

-- CreateTable
CREATE TABLE "SavedContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organization" TEXT,
    "category" TEXT NOT NULL DEFAULT 'clinica',
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#CC0000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsaasWebhookLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "paymentId" TEXT,
    "rawPayload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "errorMsg" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LeadToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LeadToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SavedContact_organizationId_idx" ON "SavedContact"("organizationId");

-- CreateIndex
CREATE INDEX "Tag_organizationId_idx" ON "Tag"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_organizationId_name_key" ON "Tag"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AsaasWebhookLog_event_idx" ON "AsaasWebhookLog"("event");

-- CreateIndex
CREATE INDEX "AsaasWebhookLog_createdAt_idx" ON "AsaasWebhookLog"("createdAt");

-- CreateIndex
CREATE INDEX "_LeadToTag_B_index" ON "_LeadToTag"("B");

-- CreateIndex
CREATE INDEX "Lead_category_idx" ON "Lead"("category");

-- CreateIndex
CREATE INDEX "Message_providerId_idx" ON "Message"("providerId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeadToTag" ADD CONSTRAINT "_LeadToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeadToTag" ADD CONSTRAINT "_LeadToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
