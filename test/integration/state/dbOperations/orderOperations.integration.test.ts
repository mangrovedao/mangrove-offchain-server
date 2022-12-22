import { TakenOffer } from "@prisma/client";
import assert from "assert";
import { describe, it } from "mocha";
import { OrderOperations } from "../../../../src/state/dbOperations/orderOperations";
import { AccountId, ChainId, MangroveId, MangroveOrderId, MangroveOrderVersionId, OfferId, OfferListId, OfferListVersionId, OfferVersionId, OrderId, StratId, TakenOfferId, TokenId } from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { MangroveOrderOperations } from "../../../../src/state/dbOperations/mangroveOrderOperations";
import { Timestamp } from "@proximaone/stream-client-js";

describe("Order Operations Integration test Suite", () => {

    let orderOperations: OrderOperations;
    let mangroveOrderOperations: MangroveOrderOperations;
    before(() => {
        orderOperations = new OrderOperations(prisma);
        mangroveOrderOperations = new MangroveOrderOperations(prisma);
    });


    const chainId = new ChainId(137);
    const mangroveId = new MangroveId(chainId, "mangroveId");
    const offerListKey = { inboundToken: "inboundAddress", outboundToken: "outboundAddress" };
    const outboundTokenId= new TokenId(chainId, offerListKey.outboundToken);
    const inboundTokenId= new TokenId(chainId, offerListKey.inboundToken);
    const offerListId = new OfferListId(mangroveId, offerListKey);
    const offerListVersionId = new OfferListVersionId(offerListId, 0);
    const takerId = new AccountId(chainId, "takerAddress");
    const orderId = new OrderId(mangroveId, offerListKey, "1");
    const offerId0 = new OfferId(mangroveId, offerListKey, 0);
    const offerId1 = new OfferId(mangroveId, offerListKey, 1);
    const offer0VersionId0 = new OfferVersionId(offerId0, 0);
    const offer0VersionId1 = new OfferVersionId(offerId0, 1);
    const offer1VersionId0 = new OfferVersionId(offerId1, 0);
    const offer1VersionId1 = new OfferVersionId(offerId1, 1);
    const takenOfferId0 = new TakenOfferId(orderId, 0);
    const takenOfferId1 = new TakenOfferId(orderId, 1);
    const makerId = new AccountId(chainId, "makerAddress");
    const mangroveOrderId = new MangroveOrderId(mangroveId, offerListKey, "mangroveOrderId" );
    const mangroveOrderVersionId = new MangroveOrderVersionId( { mangroveOrderId, versionNumber: 0});

    beforeEach(async () => {

        await prisma.token.create({ data: {
            id: inboundTokenId.value,
            chainId: chainId.value,
            address: inboundTokenId.tokenAddress,
            symbol: "i",
            name: "inbound",
            decimals: 0
        }})

        await prisma.token.create({ data: {
            id: outboundTokenId.value,
            chainId: chainId.value,
            address: outboundTokenId.tokenAddress,
            symbol: "o",
            name: "outbound",
            decimals: 0
        }})

        await prisma.offerList.create( { data: {
            id: offerListId.value,
            mangroveId: mangroveId.value,
            outboundTokenId: outboundTokenId.value,
            inboundTokenId: inboundTokenId.value,
            currentVersionId: offerListVersionId.value,

        }})

        await prisma.offer.create( { 
            data: {
                id: offerId0.value,
                offerNumber: offerId0.offerNumber,
                mangroveId: mangroveId.value,
                offerListId: offerListId.value,
                makerId: makerId.value,
                currentVersionId: offer0VersionId1.value
            }
        })

        await prisma.offer.create( { 
            data: {
                id: offerId1.value,
                offerNumber: offerId1.offerNumber,
                mangroveId: mangroveId.value,
                offerListId: offerListId.value,
                makerId: makerId.value,
                currentVersionId: offer1VersionId1.value
            }
        })

        await prisma.offerVersion.create({
            data: {
                id: offer0VersionId0.value,
                offerId: offerId0.value,
                txId: "txId",
                deleted: false,
                wants: "50",
                wantsNumber: 50,
                gives: "100",
                givesNumber: 100,
                gasprice: 10,
                gasreq: 1000,
                live: true,
                deprovisioned: false,
                versionNumber: 0
            }
        });
        await prisma.offerVersion.create({
            data: {
                id: offer0VersionId1.value,
                offerId: offerId0.value,
                txId: "txId",
                deleted: false,
                wants: "50",
                wantsNumber: 50,
                gives: "100",
                givesNumber: 100,
                gasprice: 10,
                gasreq: 1000,
                live: true,
                deprovisioned: false,
                versionNumber: 1,
                prevVersionId: offer0VersionId0.value
            }
        });

        await prisma.offerVersion.create({
            data: {
                id: offer1VersionId0.value,
                offerId: offerId1.value,
                txId: "txId",
                deleted: true,
                wants: "50",
                wantsNumber: 50,
                gives: "100",
                givesNumber: 100,
                gasprice: 10,
                gasreq: 1000,
                live: false,
                deprovisioned: false,
                versionNumber: 0

            }
        });

        await prisma.offerVersion.create({
            data: {
                id: offer1VersionId1.value,
                offerId: offerId1.value,
                txId: "txId",
                deleted: true,
                wants: "50",
                wantsNumber: 50,
                gives: "100",
                givesNumber: 100,
                gasprice: 10,
                gasreq: 1000,
                live: false,
                deprovisioned: false,
                versionNumber: 1,
                prevVersionId: offer1VersionId0.value
            }
        });

        await prisma.order.create({
            data: {
                id: orderId.value,
                mangroveId: mangroveId.value,
                offerListId: offerListId.value,
                txId: "txId",
                proximaId: orderId.proximaId,
                takerId: takerId.value,
                // takerWants: "100",
                // takerWantsNumber: 100,
                // takerGives: "50",
                // takerGivesNumber: 50,
                takerGot: "100",
                takerGotNumber: 100,
                takerGave: "50",
                takerGaveNumber: 50,
                // totalFee: "1",
                // totalFeeNumber: 1,
                bounty: "0",
                bountyNumber: 0,
                takenOffers: {
                    create: [{
                        id: takenOfferId0.value,
                        offerVersionId: offer0VersionId1.value,
                        takerGot: "100",
                        takerGotNumber: 100,
                        takerGave: "50",
                        takerGaveNumber: 50,
                        posthookFailed: false,
                    },
                    {
                        id: takenOfferId1.value,
                        offerVersionId: offer1VersionId1.value,
                        takerGot: "100",
                        takerGotNumber: 100,
                        takerGave: "50",
                        takerGaveNumber: 50,
                        posthookFailed: false,
                    }]
                }
            }
        })

        await mangroveOrderOperations.addMangroveOrderVersion( mangroveOrderId, "txId", (m) => m , {
            stratId: new StratId(chainId, "mangroveOrder").value,
            takerId: takerId.value,
            restingOrderId: offerId0.value,
            restingOrder: true,
            fillOrKill: false,
            fillWants: true,
            takerWants: "100",
            takerWantsNumber: 100,
            takerGives: "50",
            takerGivesNumber: 50,
            bounty: "0",
            bountyNumber:0,
            totalFee: "1",
            totalFeeNumber: 1
        });

        

    })

    describe("handleOrderCompleted", () => {
        it("undoOrder", async () => {
            assert.strictEqual(await prisma.offer.count(), 2);
            assert.strictEqual(await prisma.offerVersion.count(), 4);
            await orderOperations.undoOrder(mangroveId, offerListKey, orderId, { takenOffers: [{ id: 0 }, { id: 1 }] });
            assert.strictEqual(await prisma.offer.count(), 2);
            assert.strictEqual(await prisma.offerVersion.count(), 2);
        })

        it("mapTakenOffer", async () => {
            const takenOfferEvent:mangroveSchema.core.TakenOffer = {
                id: offerId0.offerNumber,
                takerWants: "50",
                takerGives: "100"
            }
            assert.strictEqual( await prisma.offer.count(), 2);
            assert.strictEqual( await prisma.offerVersion.count(), 4);
            assert.strictEqual( await prisma.mangroveOrder.count(), 1)
            assert.strictEqual( await prisma.mangroveOrderVersion.count(), 1)
            const takenOffer = await orderOperations.mapTakenOffer(orderId, takenOfferEvent, {decimals: 0}, {decimals: 0})
            assert.strictEqual( await prisma.offer.count(), 2);
            assert.strictEqual( await prisma.offerVersion.count(), 5);
            assert.strictEqual( await prisma.mangroveOrder.count(), 1)
            assert.strictEqual( await prisma.mangroveOrderVersion.count(), 2)

            assert.deepStrictEqual( takenOffer, {
                id: new TakenOfferId( orderId, offerId0.offerNumber).value,
                offerVersion:{
                    connect: { id: offer0VersionId1.value }
                } ,
                takerGot: "50",
                takerGotNumber: 50,
                takerGave: "100",
                takerGaveNumber: 100,
                takerPaidPrice: 100/50,
                makerPaidPrice: 50/100,
                posthookData: null,
                posthookFailed: false,
                failReason: null
            })
        })

        it("createOrder", async () => {
            const order:mangroveSchema.core.Order = {
                taker: takerId.address,
                takerGot: "100",
                takerGave: "50",
                penalty: "0",
                takenOffers: [{
                    id: offerId0.offerNumber,
                    takerWants: "50",
                    takerGives: "25",
                }, 
                {
                    id: offerId1.offerNumber,
                    takerWants: "50",
                    takerGives: "25",
                }]
            }
            const orderId2 = new OrderId(mangroveId, offerListKey, "2");
            assert.strictEqual( await prisma.order.count(), 1)
            assert.strictEqual( await prisma.account.count(), 0)
            assert.strictEqual( await prisma.takenOffer.count(), 2)
            await orderOperations.createOrder( mangroveId, offerListKey, order, chainId, orderId2, "txId");
            assert.strictEqual( await prisma.order.count(), 2)
            assert.strictEqual( await prisma.account.count(), 1)
            assert.strictEqual( await prisma.takenOffer.count(), 4)

        })
    })
})

