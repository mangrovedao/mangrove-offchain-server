import { describe } from "mocha";
import { AccountId, ChainId, MangroveId, OfferListId, OrderId, TakenOfferId } from "../../../../../src/state/model";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { OrderEventLogic } from "../../../../../src/state/handlers/mangroveHandler/orderEventsLogic";
import assert from "assert";


describe("Order Events Logic Unit Test Suite", () => {
    const chainId = new ChainId(123);
    const mangroveId = new MangroveId(chainId, "mangroveID");
    const tokens = { inboundToken: { name: "inbound", decimals: 0 }, outboundToken: { name: "outbound", decimals:0 }};
    const offerListKey = { inboundToken: tokens.inboundToken.name, outboundToken: tokens.outboundToken.name };
    const offerListId = new OfferListId(mangroveId, offerListKey);
    const takerId = new AccountId(chainId, "takerId");
    const orderId = new OrderId(mangroveId, offerListKey, "proximaId" );
    const parantOrderId = new OrderId(mangroveId, offerListKey, "parantOrder" );

    const orderEventsLogic = new OrderEventLogic();

    describe("createOrder", () => {

        it("order with parent order", () => {
            const order:Omit<mangroveSchema.core.Order, "takenOffers" | "taker"> = {
                takerGave: "100",
                takerGot: "50",
                penalty:"0",
            }
    
            const orderToCreate = orderEventsLogic.createOrder(mangroveId, offerListId, tokens, order, takerId, orderId, "txId", parantOrderId)

            assert.deepStrictEqual(orderToCreate, {
                id: orderId.value,
                txId: "txId",
                proximaId: orderId.proximaId,
                parentOrderId: parantOrderId.value,
                offerListId: offerListId.value,
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
            })
        })

        it("order without parent order", () => {
            const order:Omit<mangroveSchema.core.Order, "takenOffers" | "taker"> = {
                takerGave: "100",
                takerGot: "50",
                penalty:"0",
            }
    
            const orderToCreate = orderEventsLogic.createOrder(mangroveId, offerListId, tokens, order, takerId, orderId, "txId")

            assert.deepStrictEqual(orderToCreate, {
                id: orderId.value,
                txId: "txId",
                proximaId: orderId.proximaId,
                parentOrderId: null,
                offerListId: offerListId.value,
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

            const takenOfferToCreate = await orderEventsLogic.mapTakenOffer(orderId, takenOffer, tokens, (o) => { return new Promise( (resolve, reject) => { resolve( { currentVersionId:"10"})} ); });

            assert.deepStrictEqual( takenOfferToCreate, {
                id: new TakenOfferId(orderId, takenOffer.id).value,
                offerVersionId: "10",
                takerGot: takenOffer.takerWants,
                takerGotNumber: 100,
                takerGave: takenOffer.takerGives,
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                failReason: null,
                posthookData: null,
                posthookFailed: false,
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

            const takenOfferToCreate = await orderEventsLogic.mapTakenOffer(orderId, takenOffer, tokens, (o) => { return new Promise( (resolve, reject) => { resolve( { currentVersionId:"10"})} ); });

            assert.deepStrictEqual( takenOfferToCreate, {
                id: new TakenOfferId(orderId, takenOffer.id).value,
                offerVersionId: "10",
                takerGot: takenOffer.takerWants,
                takerGotNumber: 100,
                takerGave: takenOffer.takerGives,
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                failReason: takenOffer.failReason,
                posthookData: takenOffer.posthookData,
                posthookFailed: takenOffer.posthookFailed,
            })
        })
    })
})