import assert from "assert";
import { MangroveOrderEventsLogic } from "src/state/handlers/stratsHandler/mangroveOrderEventsLogic"
import * as prismaModel from "@prisma/client";

describe("Mangrove Order Events Logic Unit Test Suite", () => {
    
    const mangroveOrderEventLogic = new MangroveOrderEventsLogic("stream");



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
            assert.strictEqual(offerListKey.inboundToken, inboundToken);
            assert.strictEqual(offerListKey.outboundToken, outboundToken);
        })
    })


})