import * as prismaModel from "@prisma/client";
import assert from "assert";
import { before, describe } from "mocha";
import { OfferOperations } from "../../../../src/state/dbOperations/offerOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListId,
  OfferListKey,
  OfferVersionId,
  TokenId
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Offer Operations Integration test suite", () => {
  let offerOperations: OfferOperations;
  before(() => {
    offerOperations = new OfferOperations(prisma);
  });

  const chainId = new ChainId(10);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const outboundTokenId = new TokenId(chainId, "outboundToken");
  const inboundTokenId = new TokenId(chainId, "inboundToken");
  const offerListKey: OfferListKey = {
    outboundToken: outboundTokenId.tokenAddress,
    inboundToken: inboundTokenId.tokenAddress,
  };
  const offerId = new OfferId(mangroveId, offerListKey, 1);
  const offerVersionId = new OfferVersionId(offerId, 0);
  const offerListId = new OfferListId(mangroveId, offerListKey);
  const makerId = new AccountId(chainId, "makerAddress");
  let offer: prismaModel.Offer;
  let offerVersion: prismaModel.OfferVersion;

  beforeEach(async () => {
    offer = await prisma.offer.create({
      data: {
        id: offerId.value,
        offerNumber: offerId.offerNumber,
        offerListId: offerListId.value,
        makerId: makerId.value,
        mangroveId: mangroveId.value,
        currentVersionId: offerVersionId.value
      }
    });

    offerVersion = await prisma.offerVersion.create({
      data: {
        id: offerVersionId.value,
        offerId: offerId.value,
        txId: "txId",
        deleted: false,
        wants: "100",
        wantsNumber: 100,
        gives: "50",
        givesNumber: 50,
        gasprice: 10,
        gasreq: 200,
        live: true,
        deprovisioned: false,
        versionNumber: 0
      }
    })
  });

  describe("getOffer", () => {
    it("gets offer", async () => {
      const gottenOffer = await offerOperations.getOffer(offerId);
      assert.deepStrictEqual(gottenOffer, offer);
    })
  })


  describe("addVersionedOffer", () => {

    it("No initial value for creation", async () => {
      const newOfferId = new OfferId(mangroveId, offerListKey, 10);
      await assert.rejects( offerOperations.addVersionedOffer(newOfferId, "txId", (o) => o))
    })

    it("Add new offer and offer version", async () => {
      const newOfferId = new OfferId(mangroveId, offerListKey, 10);
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      await offerOperations.addVersionedOffer( newOfferId, "txId", (o) => o.deleted = true, { makerId: makerId});
      assert.strictEqual(await prisma.offer.count(), 2);
      assert.strictEqual(await prisma.offerVersion.count(), 2);
      const newOffer = await prisma.offer.findUnique({
        where: { id: newOfferId.value },
      });
      const newOfferVersion =
        await prisma.offerVersion.findUnique({
          where: { id: newOffer?.currentVersionId },
        });

      const newVersionId = new OfferVersionId(newOfferId, 0);
      assert.deepStrictEqual(newOffer, {
        id: newOfferId.value,
        mangroveId: newOfferId.mangroveId.value,
        offerListId: new OfferListId( newOfferId.mangroveId, newOfferId.offerListKey).value,
        offerNumber: newOfferId.offerNumber,
        makerId: makerId.value,
        currentVersionId: newVersionId.value
      });
      assert.deepStrictEqual( newOfferVersion, {
        id: newVersionId.value,
        offerId: newOfferId.value,
        txId: "txId",
        parentOrderId: null,
        prevOfferId: null,
        deleted: true,
        wants: "0",
        wantsNumber: 0,
        gives: "0",
        givesNumber: 0,
        takerPaysPrice: 0,
        makerPaysPrice: 0,
        gasprice: 0,
        gasreq: 0,
        live: false,
        deprovisioned: false,
        versionNumber: 0,
        prevVersionId: null
      });
    })



    it("Updates offer and adds new version", async () => {
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      await offerOperations.addVersionedOffer(offerId, "txId", (o) => o.deleted = true);
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 2);
      const updatedOffer = await prisma.offer.findUnique({
        where: { id: offerId.value },
      });
      const newOfferVersion =
        await prisma.offerVersion.findUnique({
          where: { id: updatedOffer?.currentVersionId },
        });
      const newVersionOfferId = new OfferVersionId(offerId, 1);
      assert.deepStrictEqual(newOfferVersion, { ...offerVersion, id: newVersionOfferId.value, versionNumber: 1, prevVersionId: new OfferVersionId(offerId, 0).value, deleted: true });
      assert.deepStrictEqual(updatedOffer, { ...offer, currentVersionId: newVersionOfferId.value });
    })
  })

  describe("deleteLatestOfferVersion", () => {
    it("Cannot find offer", async () => {
      const noMatch = new OfferId(mangroveId, offerListKey, 2);
      await assert.rejects( offerOperations.deleteLatestOfferVersion(noMatch));
    } );
    it("Cannot find offerVersion", async () => {
      await prisma.offerVersion.deleteMany();
      await assert.rejects( offerOperations.deleteLatestOfferVersion(offerId));
    } );

    it("No prevVersion, delete both offer and offerVersion", async () => {
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      await offerOperations.deleteLatestOfferVersion(offerId);
      assert.strictEqual(await prisma.offer.count(), 0);
      assert.strictEqual(await prisma.offerVersion.count(), 0);
    })

    it("Has prevVersion, update offer and delete offerVersion", async () => {
      await offerOperations.addVersionedOffer(offerId, "txId", (o) => o.gasreq=10);
      const offerToBeUpdated = await prisma.offer.findUnique({where: { id: offerId.value}});
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 2);
      await offerOperations.deleteLatestOfferVersion(offerId);
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      const updatedOffer = await prisma.offer.findUnique({where: { id: offerId.value}});
      assert.notDeepStrictEqual( updatedOffer, offerToBeUpdated);
      assert.strictEqual( updatedOffer?.currentVersionId, new OfferVersionId(offerId, 0).value)
      assert.strictEqual( offerToBeUpdated?.currentVersionId, new OfferVersionId(offerId, 1).value)

    })

  })

  describe("getCurrentOfferVersion", async () => {
    it("Cant find offer", async () => {
      const newOfferId = new OfferId(mangroveId, offerListKey, 100)
      await assert.rejects( offerOperations.getCurrentOfferVersion(newOfferId))
    })

    it("Cant find offerVersion", async () => {
      await prisma.offerVersion.deleteMany();
      await assert.rejects( offerOperations.getCurrentOfferVersion(offerId))
    })

    it("Found current offer version", async () => {
      const found = await offerOperations.getCurrentOfferVersion(offerId);
      assert.deepStrictEqual(found, offerVersion);
    })
  })

});
