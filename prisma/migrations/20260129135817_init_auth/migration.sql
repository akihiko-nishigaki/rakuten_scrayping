-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'ON_HOLD', 'EXCLUDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "rakutenAppId" TEXT,
    "categories" TEXT[],
    "rankingTypes" TEXT[],
    "topN" INTEGER NOT NULL DEFAULT 0,
    "ingestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,
    "rankingType" TEXT NOT NULL,
    "fetchedCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotItem" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "itemKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemUrl" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "apiRate" DOUBLE PRECISION,
    "rawJson" JSONB,

    CONSTRAINT "SnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedRateCurrent" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "verifiedRate" DOUBLE PRECISION NOT NULL,
    "evidenceUrl" TEXT,
    "note" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedRateCurrent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedRateHistory" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "verifiedRate" DOUBLE PRECISION NOT NULL,
    "evidenceUrl" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationTask" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "latestSnapshotItemId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),

    CONSTRAINT "VerificationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "RankingSnapshot_capturedAt_idx" ON "RankingSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "RankingSnapshot_categoryId_rankingType_idx" ON "RankingSnapshot"("categoryId", "rankingType");

-- CreateIndex
CREATE INDEX "SnapshotItem_itemKey_idx" ON "SnapshotItem"("itemKey");

-- CreateIndex
CREATE INDEX "SnapshotItem_snapshotId_rank_idx" ON "SnapshotItem"("snapshotId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedRateCurrent_itemKey_key" ON "VerifiedRateCurrent"("itemKey");

-- CreateIndex
CREATE INDEX "VerifiedRateHistory_itemKey_idx" ON "VerifiedRateHistory"("itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationTask_itemKey_key" ON "VerificationTask"("itemKey");

-- CreateIndex
CREATE INDEX "VerificationTask_status_priority_idx" ON "VerificationTask"("status", "priority");

-- AddForeignKey
ALTER TABLE "SnapshotItem" ADD CONSTRAINT "SnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedRateCurrent" ADD CONSTRAINT "VerifiedRateCurrent_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedRateHistory" ADD CONSTRAINT "VerifiedRateHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationTask" ADD CONSTRAINT "VerificationTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
