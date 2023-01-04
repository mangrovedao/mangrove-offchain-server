/*
  Warnings:

  - You are about to RENAME the column `offerListId` on the `MangroveOrder` table. All the data in the column will be lost.
  - You are about to RENAME the column `offerListId` on the `Offer` table. All the data in the column will be lost.
  - You are about to RENAME the column `offerListId` on the `Order` table. All the data in the column will be lost.
  - You are about to RENAME the column `offerListId` on the `TakerApproval` table. All the data in the column will be lost.
  - You are about to RENAME the `OfferList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to RENAME the `OfferListVersion` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `offerListingId` to the `MangroveOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offerListingId` to the `Offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offerListingId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offerListingId` to the `TakerApproval` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MangroveOrder" RENAME COLUMN "offerListId"
TO    "offerListingId";

-- AlterTable
ALTER TABLE "Offer" RENAME COLUMN "offerListId"
TO    "offerListingId";

-- AlterTable
ALTER TABLE "Order" RENAME COLUMN "offerListId"
TO "offerListingId";

-- AlterTable
ALTER TABLE "TakerApproval" RENAME COLUMN "offerListId"
TO    "offerListingId";

-- Rename Table

ALTER TABLE "OfferList"
RENAME TO "OfferListing";

-- Rename Table

ALTER TABLE "OfferListVersion"
RENAME TO "OfferListingVersion";

-- AlterTable
ALTER TABLE "OfferListingVersion" RENAME COLUMN "offerListId"
TO    "offerListingId";

