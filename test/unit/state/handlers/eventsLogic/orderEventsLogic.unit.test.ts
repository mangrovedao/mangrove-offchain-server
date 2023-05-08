import { describe } from "mocha";
import { AccountId, ChainId, MangroveId, OfferId, OfferListingId, OfferVersionId, OrderId, TakenOfferId } from "src/state/model";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { OrderEventLogic, OrderEventLogicHelper } from "src/state/handlers/mangroveHandler/orderEventsLogic";
import assert from "assert";


describe("Order Events Logic Unit Test Suite", () => {
    const chainId = new ChainId(123);
    const mangroveId = new MangroveId(chainId, "mangroveID");
    const tokens = { inboundToken: { name: "inbound", decimals: 0 }, outboundToken: { name: "outbound", decimals:0 }};
    const offerListKey = { inboundToken: tokens.inboundToken.name, outboundToken: tokens.outboundToken.name };
    const offerListingId = new OfferListingId(mangroveId, offerListKey);
    const takerId = new AccountId(chainId, "takerId");
    const orderId = new OrderId(mangroveId, offerListKey, "proximaId" );
    const parantOrderId = new OrderId(mangroveId, offerListKey, "parantOrder" );

    const orderEventsLogic = new OrderEventLogicHelper();

    describe("createOrder", () => {

        it("order with parent order", () => {
            const order:Omit<mangroveSchema.core.Order, "takenOffers" | "taker"> = {
                takerGave: "100",
                takerGot: "50",
                penalty:"0",
                feePaid: "0"
            }
    
            const orderToCreate = orderEventsLogic.createOrder(mangroveId, offerListingId, tokens, order, takerId, orderId, "txId", parantOrderId)

            assert.deepStrictEqual(orderToCreate, {
                id: orderId.value,
                txId: "txId",
                proximaId: orderId.proximaId,
                parentOrderId: parantOrderId.value,
                offerListingId: offerListingId.value,
                mangroveId: mangroveId.value,
                takerId: takerId.value,
                takerGot: order.takerGot,
                takerGotNumber: 50,
                takerGave: order.takerGave,
                takerGaveNumber: 100,
                takerPaidPrice: 2,
                makerPaidPrice: 0.5,
                bounty: order.penalty,
                bountyNumber: 0,
                totalFee: order.feePaid,
                totalFeeNumber: 0
            })
        })

        it("order without parent order", () => {
            const order:Omit<mangroveSchema.core.Order, "takenOffers" | "taker"> = {
                takerGave: "100",
                takerGot: "50",
                penalty:"0",
                feePaid: "0"
            }
    
            const orderToCreate = orderEventsLogic.createOrder(mangroveId, offerListingId, tokens, order, takerId, orderId, "txId")

            assert.deepStrictEqual(orderToCreate, {
                id: orderId.value,
                txId: "txId",
                proximaId: orderId.proximaId,
                parentOrderId: null,
                offerListingId: offerListingId.value,
                mangroveId: mangroveId.value,
                takerId: takerId.value,
                takerGot: order.takerGot,
                takerGotNumber: 50,
                takerGave: order.takerGave,
                takerGaveNumber: 100,
                takerPaidPrice: 2,
                makerPaidPrice: 0.5,
                bounty: order.penalty,
                bountyNumber: 0,
                totalFee: order.feePaid,
                totalFeeNumber: 0
            })

        })
    })

    describe("mapTakenOffer", () => {
        it("Cant find offer", async () => {
            const takenOffer: mangroveSchema.core.TakenOffer = {
                id: 1,
                takerWants: "100",
                takerGives: "50"
            }

            await assert.rejects( orderEventsLogic.mapTakenOffer(orderId, takenOffer, tokens, (o) => { return new Promise( (resolve, reject) => { resolve(null)} ); }) );
        })
        it("No fail data", async () => {
            const takenOffer: mangroveSchema.core.TakenOffer = {
                id: 1,
                takerWants: "100",
                takerGives: "50"
            }

            const takenOfferToCreateWithEvents = await orderEventsLogic.mapTakenOffer(orderId, takenOffer, tokens, (o) => { return new Promise( (resolve, reject) => { resolve( { currentVersion:{ versionNumber: 10, wants:"100" }})} ); });
            const takenOfferToCreate = takenOfferToCreateWithEvents.takenOffer
            const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOffer.id);
            assert.deepStrictEqual( takenOfferToCreate, {
                id: new TakenOfferId(orderId, takenOffer.id).value,
                offerVersionId: new OfferVersionId(offerId, 11).value,
                takerGot: takenOffer.takerWants,
                takerGotNumber: 100,
                takerGave: takenOffer.takerGives,
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                failReason: null,
                posthookData: null,
                posthookFailed: false,
                partialFill: false
            })
        })

        it("has fail data", async () => {
            const takenOffer: mangroveSchema.core.TakenOffer = {
                id: 1,
                takerWants: "100",
                takerGives: "50",
                failReason: "mgv/makerRevert",
                posthookData: "data",
                posthookFailed: true
            }

            const takenOfferToCreateWithEvents = await orderEventsLogic.mapTakenOffer(orderId, takenOffer, tokens, (o) => { return new Promise( (resolve, reject) => { resolve( { currentVersion:{ versionNumber: 10, wants:"50" } })} ); });
            const takenOfferToCreate = takenOfferToCreateWithEvents.takenOffer
            const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOffer.id);
            assert.deepStrictEqual( takenOfferToCreate, {
                id: new TakenOfferId(orderId, takenOffer.id).value,
                offerVersionId: new OfferVersionId(offerId, 11).value,
                takerGot: takenOffer.takerWants,
                takerGotNumber: 100,
                takerGave: takenOffer.takerGives,
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                failReason: takenOffer.failReason,
                posthookData: takenOffer.posthookData,
                posthookFailed: takenOffer.posthookFailed,
                partialFill: true
            })
        })
    })
})