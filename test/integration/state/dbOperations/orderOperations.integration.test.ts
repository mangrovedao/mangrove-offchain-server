import { TakenOffer } from "@prisma/client";
import assert from "assert";
import { describe, it } from "mocha";
import { OrderOperations } from "../../../../src/state/dbOperations/orderOperations";
import { AccountId, ChainId, MangroveId, OfferId, OfferListId, OfferVersionId, OrderId, TakenOfferId } from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Order Operations Integration test Suite", () => {

    let orderOperations: OrderOperations;
    before(() => {
        orderOperations = new OrderOperations(prisma);
    });


    const chainId = new ChainId(137);
    const mangroveId = new MangroveId(chainId, "mangroveId");
    const offerListKey = { inboundToken: "inboundAddress", outboundToken: "outboundAddress" };
    const offerListId = new OfferListId(mangroveId, offerListKey);
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

    beforeEach(async () => {

        await prisma.offer.create( { 
            data: {
                id: offerId0.value,
                mangroveId: mangroveId.value,
                offerListId: offerListId.value,
                makerId: makerId.value,
                currentVersionId: offer0VersionId1.value
            }
        })

        await prisma.offer.create( { 
            data: {
                id: offerId1.value,
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

    })

    describe("handleOrderCompleted", () => {
        it("undoOrder", async () => {
            assert.strictEqual(await prisma.offer.count(), 2);
            assert.strictEqual(await prisma.offerVersion.count(), 4);
            await orderOperations.undoOrder(mangroveId, offerListKey, orderId, { takenOffers: [{ id: 0 }, { id: 1 }] });
            assert.strictEqual(await prisma.offer.count(), 2);
            assert.strictEqual(await prisma.offerVersion.count(), 2);
        })

        // describe("mapTakenOffer", () => {
        //     it("")
        // })
    })
})

