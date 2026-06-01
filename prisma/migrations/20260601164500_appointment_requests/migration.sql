-- CreateEnum
CREATE TYPE "AppointmentRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled_by_lead');

-- CreateTable
CREATE TABLE "AppointmentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conversationId" TEXT,
    "vehicleId" TEXT,
    "serviceItemId" TEXT,
    "serviceName" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentRequestStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "resultingAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentRequest_organizationId_status_requestedAt_idx" ON "AppointmentRequest"("organizationId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "AppointmentRequest_leadId_idx" ON "AppointmentRequest"("leadId");

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
