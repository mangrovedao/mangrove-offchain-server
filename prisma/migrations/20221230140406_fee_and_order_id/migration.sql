/*
  Warnings:

  - Added the required column `totalFee` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalFeeNumber` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "totalFee" TEXT NOT NULL,
ADD COLUMN     "totalFeeNumber" DOUBLE PRECISION NOT NULL;
