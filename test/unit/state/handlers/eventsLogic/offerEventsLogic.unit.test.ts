import { describe } from "mocha";
import { OfferEventsLogic } from "src/state/handlers/mangroveHandler/offerEventsLogic"
import { ChainId, MangroveId, OfferId, OrderId } from "src/state/model";
import { OfferVersion } from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import assert from "assert";


describe("Offer Events Logic Unit Test Suite", () => {

    const mangroveId = new MangroveId(new ChainId(10), "1");
    const offerEventsLogic = new OfferEventsLogic("stream");
    const tokens = { inboundToken: { address: "iaddress", decimals: 0}, outboundToken: { address: "oaddress", decimals:0}}
    describe("offerWrittenFunc", () => {
        it(" Updates with offerWritten event", () => {
            const newVersion:Omit<OfferVersion, "id" | "offerId" | "versionNumber" | "prevVersionId"> = {
                txId: "",
                parentOrderId: null,
                prevOfferId: null,
                deleted: false,
                wants: "0",
                wantsNumber:0,
                gives:"0",
                givesNumber: 0,
                takerPaysPrice: 0,
                makerPaysPrice: 0,
                gasprice: 0,
                gasreq: 0,
                live: false,
                deprovisioned: true,
                kandelPopulateEventId: null,
                kandelRetractEventId: null,
            }
            const offer: mangroveSchema.core.Offer = {
                id: 1,
                prev: 0,
                wants: "10",
                gives: "5",
                gasprice: 1,
                gasreq: 1

            }
            const parentOrderId = new OrderId(mangroveId, {inboundToken: tokens.inboundToken.address, outboundToken: tokens.outboundToken.address}, "id");
            offerEventsLogic.offerWrittenFunc(newVersion,offer, mangroveId, tokens,"txId", parentOrderId)
            assert.deepStrictEqual( newVersion, {
                txId: "txId",
                parentOrderId: parentOrderId.value,
                prevOfferId: null,
                deleted: false,
                wants: "10",
                wantsNumber:10,
                gives:"5",
                givesNumber: 5,
                takerPaysPrice: 2,
                makerPaysPrice: .5,
                gasprice: 1,
                gasreq: 1,
                live: true,
                deprovisioned: false,
                kandelPopulateEventId: null,
                kandelRetractEventId: null,
            })
        })
    })

    describe("getPrevOfferId", () => {
        it("offer.prev == 0", () => {
            const prevOffer = offerEventsLogic.getPrevOfferId({prev: 0},mangroveId, tokens )
            assert.strictEqual( prevOffer, null)
        })

        it("offer.prev != 0", () => {
            const prevOffer = offerEventsLogic.getPrevOfferId({prev: 2},mangroveId, tokens )
            const offerId = new OfferId(mangroveId, {inboundToken: tokens.inboundToken.address, outboundToken: tokens.outboundToken.address}, 2);
            assert.strictEqual( prevOffer, offerId.value)
        })
    })

    describe("getDeprovisioned", () => {
        it("gasPrice = 0", () => {
            assert.strictEqual( offerEventsLogic.getDeprovisioned({gasprice:0}), true);
        })
        it("gasPrice > 0", () => {
            assert.strictEqual( offerEventsLogic.getDeprovisioned({gasprice:1}), false);
        })
    })
})