/*
  Warnings:

  - A unique constraint covering the columns `[currentVersionId]` on the table `MakerBalance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prevVersionId]` on the table `MakerBalanceVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVersionId]` on the table `Mangrove` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVersionId]` on the table `MangroveOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prevVersionId]` on the table `MangroveOrderVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `MangroveVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prevVersionId]` on the table `MangroveVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVersionId]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVersionId]` on the table `OfferListing` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prevVersionId]` on the table `OfferListingVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prevVersionId]` on the table `OfferVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVersionId]` on the table `TakerApproval` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[prevVersionId]` on the table `TakerApprovalVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "OfferListing" RENAME CONSTRAINT "OfferList_pkey" TO "OfferListing_pkey";

-- AlterTable
ALTER TABLE "OfferListingVersion" RENAME CONSTRAINT "OfferListVersion_pkey" TO "OfferListingVersion_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "MakerBalance_currentVersionId_key" ON "MakerBalance"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MakerBalanceVersion_prevVersionId_key" ON "MakerBalanceVersion"("prevVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Mangrove_currentVersionId_key" ON "Mangrove"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MangroveOrder_currentVersionId_key" ON "MangroveOrder"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MangroveOrderVersion_prevVersionId_key" ON "MangroveOrderVersion"("prevVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MangroveVersion_id_key" ON "MangroveVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MangroveVersion_prevVersionId_key" ON "MangroveVersion"("prevVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_currentVersionId_key" ON "Offer"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferListing_currentVersionId_key" ON "OfferListing"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferListingVersion_prevVersionId_key" ON "OfferListingVersion"("prevVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferVersion_prevVersionId_key" ON "OfferVersion"("prevVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TakerApproval_currentVersionId_key" ON "TakerApproval"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TakerApprovalVersion_prevVersionId_key" ON "TakerApprovalVersion"("prevVersionId");
