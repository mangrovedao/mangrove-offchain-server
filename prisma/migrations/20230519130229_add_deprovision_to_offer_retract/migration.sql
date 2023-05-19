/*
  Warnings:

  - Added the required column `deprovision` to the `OfferRetractEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OfferRetractEvent" ADD COLUMN     "deprovision" BOOLEAN NOT NULL;
