import * as prismaModel from "@prisma/client";
import assert from "assert";
import { describe } from "mocha";
import { MangroveOrderEventsLogic } from "../../../../../src/state/handlers/stratsHandler/mangroveOrderEventsLogic";


describe(" Mangrove Order Event Logic integration test suite", () => {
    
    const mangroveOrderEventLogic = new MangroveOrderEventsLogic();

    describe("updateMangroveOrderFromTakenOffer", () => {
        it("Update with taken offer", async () => {
          const takenOffer: Omit<prismaModel.TakenOffer, "orderId" | "offerVersionId"> =
            {
              id: "takenOffer",
              takerGot: "50",
              takerGotNumber: 50,
              takerGave: "25",
              takerGaveNumber: 25,
              takerPaidPrice: 0.5,
              makerPaidPrice: 2,
              posthookFailed: true,
              posthookData: "posthookData",
              failReason: "failReason",
            };
    
          const tokens = { outboundToken: { decimals: 0}, inboundToken: { decimals: 0} };
          const mangroveOrder = { fillWants: true, takerWants: "50", takerGives: "25", totalFee: "0"};
          const newVersion:Omit< prismaModel.MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId" > = {
            txId: "txId",
            failed: false,
            cancelled: false,
            filled: false,
            failedReason: null,
            takerGot: "0",
            takerGotNumber: 0,
            takerGave: "0",
            takerGaveNumber: 0,
            price: 0,
            expiryDate: new Date(),
          }
          const versionBefore = newVersion;

          
          mangroveOrderEventLogic.updateMangroveOrderFromTakenOffer( takenOffer, tokens, mangroveOrder, newVersion);

          assert.strictEqual(newVersion.filled, true);
          assert.strictEqual(newVersion.cancelled, versionBefore.cancelled);
          assert.strictEqual(newVersion.failed, true);
          assert.strictEqual(newVersion.failedReason, takenOffer.failReason);
          assert.strictEqual(newVersion.takerGot, takenOffer.takerGot);
          assert.strictEqual(newVersion.takerGotNumber, takenOffer.takerGotNumber);
          assert.strictEqual(newVersion.takerGave, takenOffer.takerGave);
          assert.strictEqual(newVersion.takerGaveNumber, takenOffer.takerGaveNumber);
          assert.strictEqual(newVersion.price, takenOffer.takerGaveNumber / takenOffer.takerGotNumber);
          assert.deepStrictEqual(
            newVersion.expiryDate,
            versionBefore.expiryDate
          );
        });
      });
})