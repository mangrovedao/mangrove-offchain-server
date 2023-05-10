/*
  Warnings:

  - Added the required column `hasRestingOrder` to the `MangroveOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isRetracted` to the `OfferVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TakenOffer" RENAME COLUMN "partialFill" TO "fullyTaken";