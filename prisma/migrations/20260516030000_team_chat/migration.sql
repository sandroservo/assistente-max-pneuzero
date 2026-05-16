-- CreateTable
CREATE TABLE "TeamMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "dmKey" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamChannelState" (
    "userId" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamChannelState_pkey" PRIMARY KEY ("userId","channelKey")
);

-- CreateIndex
CREATE INDEX "TeamMessage_organizationId_dmKey_createdAt_idx" ON "TeamMessage"("organizationId", "dmKey", "createdAt");

-- CreateIndex
CREATE INDEX "TeamMessage_organizationId_createdAt_idx" ON "TeamMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamChannelState_userId_idx" ON "TeamChannelState"("userId");

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChannelState" ADD CONSTRAINT "TeamChannelState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
