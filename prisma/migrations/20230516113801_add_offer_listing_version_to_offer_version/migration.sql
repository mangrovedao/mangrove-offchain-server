/*
  Warnings:

  - Added the required column `offerListingVersionId` to the `OfferVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OfferVersion" ADD COLUMN     "offerListingVersionId" VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE INDEX "OfferVersion_offerListingVersionId_idx" ON "OfferVersion"("offerListingVersionId");
