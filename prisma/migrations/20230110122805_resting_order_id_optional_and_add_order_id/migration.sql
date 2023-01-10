/*
  Warnings:

  - Added the required column `orderId` to the `MangroveOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MangroveOrder" ADD COLUMN     "orderId" VARCHAR(255) NOT NULL,
ALTER COLUMN "restingOrderId" DROP NOT NULL;
