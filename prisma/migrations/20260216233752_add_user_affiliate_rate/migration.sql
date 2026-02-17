-- CreateTable
CREATE TABLE "UserAffiliateRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "affiliateRate" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAffiliateRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAffiliateRate_userId_idx" ON "UserAffiliateRate"("userId");

-- CreateIndex
CREATE INDEX "UserAffiliateRate_itemKey_idx" ON "UserAffiliateRate"("itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserAffiliateRate_userId_itemKey_key" ON "UserAffiliateRate"("userId", "itemKey");

-- AddForeignKey
ALTER TABLE "UserAffiliateRate" ADD CONSTRAINT "UserAffiliateRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
