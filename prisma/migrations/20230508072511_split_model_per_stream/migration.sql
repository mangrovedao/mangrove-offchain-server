/*
  Warnings:

  - You are about to drop the column `cancelled` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `failed` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `failedReason` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `filled` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `takerGave` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `takerGaveNumber` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `takerGot` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - You are about to drop the column `takerGotNumber` on the `MangroveOrderVersion` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[offerVersionId]` on the table `TakenOffer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reserveId,tokenId,stream]` on the table `TokenBalance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stream` to the `TokenBalance` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TokenBalance_reserveId_tokenId_key";

-- AlterTable
ALTER TABLE "MangroveOrderVersion" DROP COLUMN "cancelled",
DROP COLUMN "failed",
DROP COLUMN "failedReason",
DROP COLUMN "filled",
DROP COLUMN "price",
DROP COLUMN "takerGave",
DROP COLUMN "takerGaveNumber",
DROP COLUMN "takerGot",
DROP COLUMN "takerGotNumber";

-- AlterTable
ALTER TABLE "TakenOffer" ADD COLUMN     "partialFill" BOOLEAN;

-- AlterTable
ALTER TABLE "TokenBalance" ADD COLUMN     "stream" VARCHAR(255) NOT NULL;

-- CreateTable
CREATE TABLE "MangroveEvent" (
    "id" TEXT NOT NULL,
    "mangroveId" TEXT NOT NULL,
    "txId" TEXT NOT NULL,

    CONSTRAINT "MangroveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferWriteEvent" (
    "id" TEXT NOT NULL,
    "offerListingId" TEXT NOT NULL,
    "offerVersionId" TEXT NOT NULL,
    "makerId" TEXT NOT NULL,
    "mangroveEventId" TEXT NOT NULL,
    "wants" TEXT NOT NULL,
    "gives" TEXT NOT NULL,
    "gasprice" DOUBLE PRECISION NOT NULL,
    "gasreq" DOUBLE PRECISION NOT NULL,
    "prev" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OfferWriteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferRetractEvent" (
    "id" TEXT NOT NULL,
    "offerListingId" TEXT NOT NULL,
    "offerVersionId" TEXT NOT NULL,
    "mangroveEventId" TEXT NOT NULL,

    CONSTRAINT "OfferRetractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MangroveOrderSetExpiryEvent" (
    "id" TEXT NOT NULL,
    "mangroveOrderVersionId" VARCHAR(255) NOT NULL,
    "expiryDate" TIMESTAMP NOT NULL,

    CONSTRAINT "MangroveOrderSetExpiryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MangroveEvent_mangroveId_idx" ON "MangroveEvent"("mangroveId");

-- CreateIndex
CREATE INDEX "MangroveEvent_txId_idx" ON "MangroveEvent"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferWriteEvent_offerVersionId_key" ON "OfferWriteEvent"("offerVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferWriteEvent_mangroveEventId_key" ON "OfferWriteEvent"("mangroveEventId");

-- CreateIndex
CREATE INDEX "OfferWriteEvent_offerListingId_idx" ON "OfferWriteEvent"("offerListingId");

-- CreateIndex
CREATE INDEX "OfferWriteEvent_offerVersionId_idx" ON "OfferWriteEvent"("offerVersionId");

-- CreateIndex
CREATE INDEX "OfferWriteEvent_makerId_idx" ON "OfferWriteEvent"("makerId");

-- CreateIndex
CREATE INDEX "OfferWriteEvent_mangroveEventId_idx" ON "OfferWriteEvent"("mangroveEventId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferRetractEvent_offerVersionId_key" ON "OfferRetractEvent"("offerVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferRetractEvent_mangroveEventId_key" ON "OfferRetractEvent"("mangroveEventId");

-- CreateIndex
CREATE INDEX "OfferRetractEvent_offerListingId_idx" ON "OfferRetractEvent"("offerListingId");

-- CreateIndex
CREATE INDEX "OfferRetractEvent_offerVersionId_idx" ON "OfferRetractEvent"("offerVersionId");

-- CreateIndex
CREATE INDEX "OfferRetractEvent_mangroveEventId_idx" ON "OfferRetractEvent"("mangroveEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MangroveOrderSetExpiryEvent_mangroveOrderVersionId_key" ON "MangroveOrderSetExpiryEvent"("mangroveOrderVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TakenOffer_offerVersionId_key" ON "TakenOffer"("offerVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_reserveId_tokenId_stream_key" ON "TokenBalance"("reserveId", "tokenId", "stream");
