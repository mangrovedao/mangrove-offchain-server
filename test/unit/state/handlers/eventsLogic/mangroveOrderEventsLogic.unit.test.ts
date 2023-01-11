import assert from "assert";
import { MangroveOrderEventsLogic } from "src/state/handlers/stratsHandler/mangroveOrderEventsLogic"
import * as prismaModel from "@prisma/client";

describe("Mangrove Order Events Logic Unit Test Suite", () => {
    
    const mangroveOrderEventLogic = new MangroveOrderEventsLogic();

    describe("getFilled", ()=> {
        it("fillWants=true, not filled", () => {
            const filled = mangroveOrderEventLogic.getFilled({ fillWants: true, takerGave: "100", takerGot: "40", takerGives:"100", takerWants:"50", fee:"1" }, {decimals:0})
            assert.strictEqual( filled, false)
        })

        it("fillWants=true, is filled", () => {
            const filled = mangroveOrderEventLogic.getFilled({ fillWants: true, takerGave: "100", takerGot: "49", takerGives:"100", takerWants:"50", fee:"1" }, {decimals:0})
            assert.strictEqual( filled, true)
        })

        it("fillWants=false, not filled", () => {
            const filled = mangroveOrderEventLogic.getFilled({ fillWants: true, takerGave: "90", takerGot: "40", takerGives:"100", takerWants:"50", fee:"1" }, {decimals:0})
            assert.strictEqual( filled, false)
        })

        it("fillWants=false, is filled", () => {
            const filled = mangroveOrderEventLogic.getFilled({ fillWants: true, takerGave: "100", takerGot: "49", takerGives:"100", takerWants:"50", fee:"1" }, {decimals:0})
            assert.strictEqual( filled, true)
        })
    })

    describe("getFailedReason", () => {
        it("returns failedReasom", () =>{
            const failedReason = mangroveOrderEventLogic.getFailedReason({failReason: "failed", posthookData: "data"});
            assert.strictEqual(failedReason, "failed")
        })
        it("returns posthookData", () => {
            const failedReason = mangroveOrderEventLogic.getFailedReason({failReason: null, posthookData: "data"});
            assert.strictEqual(failedReason, "data")
        })
        it("returns null", () => {
            const failedReason = mangroveOrderEventLogic.getFailedReason({failReason: null, posthookData: null});
            assert.strictEqual(failedReason, null)
        })
    })

    describe("getFailed", () => {
        it("posthookFailed = false, poosthookData == null", () => {
            const failed =mangroveOrderEventLogic.getFailed({posthookFailed: false, posthookData:null})
            assert.strictEqual(failed, false)
        })
        it("posthookFailed = false, poosthookData != null", () => {
            const failed =mangroveOrderEventLogic.getFailed({posthookFailed: false, posthookData:"data"})
            assert.strictEqual(failed, true)
        })
        it("posthookFailed = true, poosthookData == null", () => {
            const failed =mangroveOrderEventLogic.getFailed({posthookFailed: true, posthookData:null})
            assert.strictEqual(failed, true)
        })
        it("posthookFailed = true, poosthookData != null", () => {
            const failed =mangroveOrderEventLogic.getFailed({posthookFailed: true, posthookData:"data"})
            assert.strictEqual(failed, true)
        })
    })

    describe("getOfferListFromOrderSummary", () => {
        it("fillWants = true", () => {
            const outboundToken = "outbound";
            const inboundToken = "inbound";
            const offerListKey  = mangroveOrderEventLogic.getOfferListFromOrderSummary({ fillWants:true, outboundToken: outboundToken, inboundToken: inboundToken})
            assert.strictEqual(offerListKey.inboundToken, inboundToken);
            assert.strictEqual(offerListKey.outboundToken, outboundToken);
        })
        it("fillWants = false", () => {
            const outboundToken = "outbound";
            const inboundToken = "inbound";
            const offerListKey  = mangroveOrderEventLogic.getOfferListFromOrderSummary({ fillWants:false, outboundToken: outboundToken, inboundToken: inboundToken})
            assert.strictEqual(offerListKey.inboundToken, outboundToken);
            assert.strictEqual(offerListKey.outboundToken, inboundToken);
        })
    })

    describe("newVersionOfMangroveOrderFromTakenOffer", () => {
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

          
          mangroveOrderEventLogic.newVersionOfMangroveOrderFromTakenOffer( takenOffer, tokens, mangroveOrder, newVersion);

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