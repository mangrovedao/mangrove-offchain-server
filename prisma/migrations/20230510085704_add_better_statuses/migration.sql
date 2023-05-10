/*
  Warnings:

  - Added the required column `hasRestingOrder` to the `MangroveOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isRetracted` to the `OfferVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MangroveOrder" ADD COLUMN     "hasRestingOrder" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "OfferVersion" ADD COLUMN     "isRetracted" BOOLEAN NOT NULL;
