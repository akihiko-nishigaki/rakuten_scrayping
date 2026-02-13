-- CreateTable
CREATE TABLE "ShopIdMapping" (
    "shopCode" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopIdMapping_pkey" PRIMARY KEY ("shopCode")
);
