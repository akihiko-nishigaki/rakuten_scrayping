-- CreateTable
CREATE TABLE "AffiliateIdCache" (
    "itemKey" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateIdCache_pkey" PRIMARY KEY ("itemKey")
);
