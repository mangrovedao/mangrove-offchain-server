/*
  Warnings:

  - You are about to drop the column `deleted` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `penalty` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `makerPaysPrice` on the `TakenOffer` table. All the data in the column will be lost.
  - You are about to drop the column `takerGives` on the `TakenOffer` table. All the data in the column will be lost.
  - You are about to drop the column `takerGivesNumber` on the `TakenOffer` table. All the data in the column will be lost.
  - You are about to drop the column `takerPaysPrice` on the `TakenOffer` table. All the data in the column will be lost.
  - You are about to drop the column `takerWants` on the `TakenOffer` table. All the data in the column will be lost.
  - You are about to drop the column `takerWantsNumber` on the `TakenOffer` table. All the data in the column will be lost.
  - You are about to drop the `OrderSummary` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `offerNumber` to the `Offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bounty` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bountyNumber` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proximaId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offerVersionId` to the `TakenOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `takerGave` to the `TakenOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `takerGaveNumber` to the `TakenOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `takerGot` to the `TakenOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `takerGotNumber` to the `TakenOffer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "deleted",
ADD COLUMN     "offerNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OfferVersion" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "penalty",
ADD COLUMN     "bounty" TEXT NOT NULL,
ADD COLUMN     "bountyNumber" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "proximaId" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "TakenOffer" DROP COLUMN "makerPaysPrice",
DROP COLUMN "takerGives",
DROP COLUMN "takerGivesNumber",
DROP COLUMN "takerPaysPrice",
DROP COLUMN "takerWants",
DROP COLUMN "takerWantsNumber",
ADD COLUMN     "makerPaidPrice" DOUBLE PRECISION,
ADD COLUMN     "offerVersionId" VARCHAR(255) NOT NULL,
ADD COLUMN     "posthookData" TEXT,
ADD COLUMN     "takerGave" TEXT NOT NULL,
ADD COLUMN     "takerGaveNumber" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "takerGot" VARCHAR(80) NOT NULL,
ADD COLUMN     "takerGotNumber" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "takerPaidPrice" DOUBLE PRECISION;

-- DropTable
DROP TABLE "OrderSummary";

-- CreateTable
CREATE TABLE "MangroveOrder" (
    "id" VARCHAR(255) NOT NULL,
    "mangroveId" VARCHAR(255) NOT NULL,
    "stratId" VARCHAR(255) NOT NULL,
    "offerListId" VARCHAR(255) NOT NULL,
    "takerId" VARCHAR(255) NOT NULL,
    "proximaId" VARCHAR(255) NOT NULL,
    "restingOrderId" VARCHAR(255) NOT NULL,
    "restingOrder" BOOLEAN NOT NULL,
    "fillOrKill" BOOLEAN NOT NULL,
    "fillWants" BOOLEAN NOT NULL,
    "takerWants" TEXT NOT NULL,
    "takerWantsNumber" DOUBLE PRECISION NOT NULL,
    "takerGives" TEXT NOT NULL,
    "takerGivesNumber" DOUBLE PRECISION NOT NULL,
    "bounty" TEXT NOT NULL,
    "bountyNumber" DOUBLE PRECISION NOT NULL,
    "totalFee" TEXT NOT NULL,
    "totalFeeNumber" DOUBLE PRECISION NOT NULL,
    "currentVersionId" VARCHAR(255) NOT NULL,

    CONSTRAINT "MangroveOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MangroveOrderVersion" (
    "id" VARCHAR(255) NOT NULL,
    "txId" VARCHAR(255) NOT NULL,
    "mangroveOrderId" VARCHAR(255) NOT NULL,
    "filled" BOOLEAN NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "failed" BOOLEAN NOT NULL,
    "failedReason" TEXT,
    "takerGot" TEXT NOT NULL,
    "takerGotNumber" DOUBLE PRECISION NOT NULL,
    "takerGave" TEXT NOT NULL,
    "takerGaveNumber" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "expiryDate" TIMESTAMP NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "prevVersionId" VARCHAR(255),

    CONSTRAINT "MangroveOrderVersion_pkey" PRIMARY KEY ("id")
);
