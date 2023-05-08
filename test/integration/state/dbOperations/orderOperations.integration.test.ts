import { OfferVersion, Order, TakenOffer } from "@prisma/client";
import assert from "assert";
import { describe, it } from "mocha";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { MangroveOrderOperations } from "src/state/dbOperations/mangroveOrderOperations";
import { OfferOperations } from "src/state/dbOperations/offerOperations";
import { OrderOperations } from "src/state/dbOperations/orderOperations";
import { AccountId, ChainId, MangroveId, MangroveOrderId, OfferId, OfferListingId, OfferListingVersionId, OfferVersionId, OrderId, TakenOfferId, TokenId } from "src/state/model";
import { prisma } from "utils/test/mochaHooks";

describe("Order Operations Integration test Suite", () => {

    let orderOperations: OrderOperations;
    let mangroveOrderOperations: MangroveOrderOperations;
    let offerOperations: OfferOperations;
    before(() => {
        orderOperations = new OrderOperations(prisma);
        mangroveOrderOperations = new MangroveOrderOperations(prisma);
        offerOperations = new OfferOperations(prisma);
    });


    const chainId = new ChainId(137);
    const mangroveId = new MangroveId(chainId, "mangroveId");
    const offerListKey = { inboundToken: "inboundAddress", outboundToken: "outboundAddress" };
    const outboundTokenId = new TokenId(chainId, offerListKey.outboundToken);
    const inboundTokenId = new TokenId(chainId, offerListKey.inboundToken);
    const offerListingId = new OfferListingId(mangroveId, offerListKey);
    const offerListingVersionId = new OfferListingVersionId(offerListingId, 0);
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
    const mangroveOrderId = new MangroveOrderId(mangroveId, offerListKey, "mangroveOrderId");
    let offer0Version0: OfferVersion;
    let offer0Version1: OfferVersion;
    let offer1Version0: OfferVersion;
    let offer1Version1: OfferVersion;

    beforeEach(async () => {

        await prisma.token.create({
            data: {
                id: inboundTokenId.value,
                chainId: chainId.value,
                address: inboundTokenId.tokenAddress,
                symbol: "i",
                name: "inbound",
                decimals: 0
            }
        })

        await prisma.token.create({
            data: {
                id: outboundTokenId.value,
                chainId: chainId.value,
                address: outboundTokenId.tokenAddress,
                symbol: "o",
                name: "outbound",
                decimals: 0
            }
        })

        await prisma.offerListing.create({
            data: {
                id: offerListingId.value,
                mangroveId: mangroveId.value,
                outboundTokenId: outboundTokenId.value,
                inboundTokenId: inboundTokenId.value,
                currentVersionId: offerListingVersionId.value,

            }
        })

        await prisma.offer.create({
            data: {
                id: offerId0.value,
                offerNumber: offerId0.offerNumber,
                mangroveId: mangroveId.value,
                offerListingId: offerListingId.value,
                makerId: makerId.value,
                currentVersionId: offer0VersionId1.value
            }
        })

        await prisma.offer.create({
            data: {
                id: offerId1.value,
                offerNumber: offerId1.offerNumber,
                mangroveId: mangroveId.value,
                offerListingId: offerListingId.value,
                makerId: makerId.value,
                currentVersionId: offer1VersionId1.value
            }
        })

        offer0Version0 = await prisma.offerVersion.create({
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
        offer0Version1 = await prisma.offerVersion.create({
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

        offer1Version0 = await prisma.offerVersion.create({
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

        offer1Version1 = await prisma.offerVersion.create({
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
                offerListingId: offerListingId.value,
                txId: "txId",
                proximaId: orderId.proximaId,
                takerId: takerId.value,
                takerGot: "100",
                takerGotNumber: 100,
                takerGave: "50",
                takerGaveNumber: 50,
                totalFee: "1",
                totalFeeNumber: 1,
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

        await mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId, "txId", (m) => m, {
            stratId: new AccountId(chainId, "mangroveOrder").value,
            orderId: new OrderId(mangroveId, offerListKey, "proximaId").value,
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
            bountyNumber: 0,
            totalFee: "1",
            totalFeeNumber: 1
        });



    })

    it("undoOrder", async () => {
        await mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId, "txId", (m => m.expiryDate = new Date(2023, 1, 1)));
        assert.strictEqual(await prisma.offer.count(), 2);
        assert.strictEqual(await prisma.offerVersion.count(), 4);
        assert.strictEqual(await prisma.mangroveOrder.count(), 1);
        assert.strictEqual(await prisma.mangroveOrderVersion.count(), 2);
        await orderOperations.undoOrder(mangroveId, offerListKey, orderId, { takenOffers: [{ id: 0 }, { id: 1 }] });
        assert.strictEqual(await prisma.offer.count(), 2);
        assert.strictEqual(await prisma.offerVersion.count(), 2);
        assert.strictEqual(await prisma.mangroveOrder.count(), 1);
        assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
    })


    describe("createOrder", () => {

        it("Creates order, takenOffers, offerVersions and mangroveOrderVersion", async () => {
            const newOrderId = new OrderId(mangroveId, offerListKey, "2")
            const newOrder: Order = {
                id: newOrderId.value,
                txId: "txId",
                proximaId: newOrderId.proximaId,
                parentOrderId: null,
                offerListingId: offerListingId.value,
                mangroveId: mangroveId.value,
                takerId: takerId.value,
                takerGot: "100",
                takerGotNumber: 100,
                takerGave: "50",
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                bounty: "0",
                bountyNumber: 0,
                totalFee: "1",
                totalFeeNumber: 1,
            };

            const takenOffer0 = {
                id: new TakenOfferId(newOrderId, offerId0.offerNumber).value,
                offerVersionId: new OfferVersionId(offerId0, 2).value,
                takerGot: "50",
                takerGotNumber: 50,
                takerGave: "25",
                takerGaveNumber: 25,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                failReason: "",
                posthookData: "",
                posthookFailed: false,
                partialFill: false,
            }

            const takenOffers= [{takenOffer:takenOffer0, takenOfferEvent:{id:0}},
                { 
                    takenOffer: {
                        id: new TakenOfferId(newOrderId, offerId1.offerNumber).value,
                        offerVersionId: new OfferVersionId(offerId1, 2).value,
                        takerGot: "50",
                        takerGotNumber: 50,
                        takerGave: "25",
                        takerGaveNumber: 25,
                        takerPaidPrice: 0.5,
                        makerPaidPrice: 2,
                        failReason: "failReason",
                        posthookData: "posthookData",
                        posthookFailed: true,
                        partialFill: true,
                    },
                    takenOfferEvent: {
                        id: 1
                    }
                }
            ]


            assert.strictEqual(await prisma.order.count(), 1)
            assert.strictEqual(await prisma.account.count(), 0)
            assert.strictEqual(await prisma.takenOffer.count(), 2)
            assert.strictEqual(await prisma.mangroveOrder.count(), 1)
            assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1)
            assert.strictEqual(await prisma.offer.count(), 2)
            assert.strictEqual(await prisma.offerVersion.count(), 4)
            await orderOperations.createOrder(newOrderId, newOrder, takenOffers);
            assert.strictEqual(await prisma.order.count(), 2)
            assert.strictEqual(await prisma.takenOffer.count(), 4)
            assert.strictEqual(await prisma.mangroveOrder.count(), 1)
            assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1)
            assert.strictEqual(await prisma.offer.count(), 2)
            assert.strictEqual(await prisma.offerVersion.count(), 6)

        })

        it("OfferVersion doesnt exist", async () => {
            const newOrderId = new OrderId(mangroveId, offerListKey, "2")
            const newOrder: Order = {
                id: newOrderId.value,
                txId: "txId",
                proximaId: newOrderId.proximaId,
                parentOrderId: null,
                offerListingId: offerListingId.value,
                mangroveId: mangroveId.value,
                takerId: takerId.value,
                takerGot: "100",
                takerGotNumber: 100,
                takerGave: "50",
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                bounty: "0",
                bountyNumber: 0,
                totalFee: "1",
                totalFeeNumber: 1,
            };
            const offerId2 = new OfferId(mangroveId, offerListKey, 2);
            await offerOperations.addVersionedOffer(offerId2, "txId", (o) => { }, { makerId: makerId })


            const takenOffers = [{
                takenOffer: {
                    id: new TakenOfferId(newOrderId, offerId0.offerNumber).value,
                    offerVersionId: new OfferVersionId(offerId2, 4).value, // offer 4 should not exist
                    takerGot: "50",
                    takerGotNumber: 50,
                    takerGave: "25",
                    takerGaveNumber: 25,
                    takerPaidPrice: 0.5,
                    makerPaidPrice: 2,
                    failReason: "failReasn",
                    posthookData: "posthookData",
                    posthookFailed: true,
                    partialFill: false,
                }, takenOfferEvent: {
                    id: 2
                }
            }
            ]
            await assert.rejects(orderOperations.createOrder(newOrderId, newOrder, takenOffers));
        })

        it("Offer from offerVersion does not exist", async () => {
            const newOrderId = new OrderId(mangroveId, offerListKey, "2")
            const newOrder: Order = {
                id: newOrderId.value,
                txId: "txId",
                proximaId: newOrderId.proximaId,
                parentOrderId: null,
                offerListingId: offerListingId.value,
                mangroveId: mangroveId.value,
                takerId: takerId.value,
                takerGot: "100",
                takerGotNumber: 100,
                takerGave: "50",
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                bounty: "0",
                bountyNumber: 0,
                totalFee: "1",
                totalFeeNumber: 1,
            };
            const offerId2 = new OfferId(mangroveId, offerListKey, 2);
            await offerOperations.addVersionedOffer(offerId2, "txId", (o) => { }, { makerId: makerId })
            await prisma.offerVersion.update({ where: { id: new OfferVersionId(offerId2, 0).value }, data: { offerId: "noMatch" } })

            const takenOffers: {
                takenOffer: Omit<TakenOffer, "orderId">;
                takenOfferEvent: { id: number };
            }[] = [{
                takenOffer: {
                    id: new TakenOfferId(newOrderId, offerId0.offerNumber).value,
                    offerVersionId: new OfferVersionId(offerId2, 0).value,
                    takerGot: "50",
                    takerGotNumber: 50,
                    takerGave: "25",
                    takerGaveNumber: 25,
                    takerPaidPrice: 0.5,
                    makerPaidPrice: 2,
                    failReason: "failReasn",
                    posthookData: "posthookData",
                    posthookFailed: true,
                    partialFill: true,
                },
                takenOfferEvent: {
                    id: 2
                }
            }

                ]
            await assert.rejects(orderOperations.createOrder(newOrderId, newOrder, takenOffers));
        })

        it("OfferVersion is not current version", async () => {
            const newOrderId = new OrderId(mangroveId, offerListKey, "2")
            const newOrder: Order = {
                id: newOrderId.value,
                txId: "txId",
                proximaId: newOrderId.proximaId,
                parentOrderId: null,
                offerListingId: offerListingId.value,
                mangroveId: mangroveId.value,
                takerId: takerId.value,
                takerGot: "100",
                takerGotNumber: 100,
                takerGave: "50",
                takerGaveNumber: 50,
                takerPaidPrice: 0.5,
                makerPaidPrice: 2,
                bounty: "0",
                bountyNumber: 0,
                totalFee: "1",
                totalFeeNumber: 1,
            };
            const offerId2 = new OfferId(mangroveId, offerListKey, 2);
            await offerOperations.addVersionedOffer(offerId2, "txId", () => { }, { makerId: makerId })
            await offerOperations.addVersionedOffer(offerId2, "txId", (o) => o.deleted = true, { makerId: makerId }) // creates new version,

            const takenOffers: {
                takenOffer: Omit<TakenOffer, "orderId">;
                takenOfferEvent: { id: number };
            }[] = [{
                takenOffer: {
                    id: new TakenOfferId(newOrderId, offerId0.offerNumber).value,
                    offerVersionId: new OfferVersionId(offerId2, 0).value,  // points to old version, not the current version
                    takerGot: "50",
                    takerGotNumber: 50,
                    takerGave: "25",
                    takerGaveNumber: 25,
                    takerPaidPrice: 0.5,
                    makerPaidPrice: 2,
                    failReason: "failReasn",
                    posthookData: "posthookData",
                    posthookFailed: true,
                    partialFill: false
                },
                takenOfferEvent: {
                    id: 2
                }
            }
                ]
            await assert.rejects(orderOperations.createOrder(newOrderId, newOrder, takenOffers));
        })
    })

    it("deleteOrder", async () => {
        assert.strictEqual(1, await prisma.order.count());
        await orderOperations.deleteOrder(orderId);
        assert.strictEqual(0, await prisma.order.count());
    })

})

