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

  describe("markOfferAsDeleted", () => {
    it("Cannot find offer", async () => {
      const noMatch = new OfferId(mangroveId, offerListKey, 100);
      await assert.rejects(offerOperations.markOfferAsDeleted(noMatch));
    })
    it("Cannot find current version", async () => {
      await prisma.offerVersion.deleteMany()
      await assert.rejects(offerOperations.markOfferAsDeleted(offerId));
    })
    it("Marks offer as deleted", async () => {
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      await offerOperations.markOfferAsDeleted(offerId);
      assert.strictEqual(await prisma.offerVersion.count(), 2);
      const updatedOffer = await offerOperations.getOffer(offerId);
      if (!updatedOffer) {
        assert.fail();
      }
      const newVersion = await offerOperations.getVersionedOffer(updatedOffer.currentVersionId);
      offerVersion.deleted = true;
      offerVersion.versionNumber = 1;
      offerVersion.prevVersionId = offerVersion.id;
      offerVersion.id = new OfferVersionId(offerId, 1).value;
      assert.deepStrictEqual(newVersion, offerVersion);

    })
  })

  describe("getVersionedOffer", () => {
    it("gets versioned offer", async () => {
      const gottenOfferVersion = await offerOperations.getVersionedOffer(offerVersionId.value);
      assert.deepStrictEqual(gottenOfferVersion, offerVersion);
    })
  })

  describe("addVersionedOffer", () => {
    it("Add new offer and offer version", async () => {
      const newOfferId = new OfferId(mangroveId, offerListKey, 10);
      const toBeOffer = offer;
      offer.id = newOfferId.value;
      const toBeOfferVersion = offerVersion;
      toBeOfferVersion.deleted = true;
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      await offerOperations.addVersionedOffer(newOfferId, toBeOffer, toBeOfferVersion);
      assert.strictEqual(await prisma.offer.count(), 2);
      assert.strictEqual(await prisma.offerVersion.count(), 2);
      const newOffer = await prisma.offer.findUnique({
        where: { id: newOfferId.value },
      });
      const newOfferVersion =
        await prisma.offerVersion.findUnique({
          where: { id: newOffer?.currentVersionId },
        });
      assert.deepStrictEqual(toBeOffer, newOffer);
      const newOfferVersionId = new OfferVersionId( newOfferId, 0 );
      assert.strictEqual(
        newOffer?.currentVersionId,
        newOfferVersionId.value
      );
      assert.deepStrictEqual( newOfferVersion, toBeOfferVersion);
    })

    it("Cannot find current version", async () => {
      await prisma.offerVersion.deleteMany();
      await assert.rejects( offerOperations.addVersionedOffer( offerId, offer, offerVersion));
    })

    it("Updates offer and adds new version", async () => {
      const toBeOfferVersion = offerVersion;
      toBeOfferVersion.deleted = true;
      assert.strictEqual(await prisma.offer.count(), 1);
      assert.strictEqual(await prisma.offerVersion.count(), 1);
      await offerOperations.addVersionedOffer(offerId, offer, toBeOfferVersion);
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
      toBeOfferVersion.id = newVersionOfferId.value;
      toBeOfferVersion.versionNumber = 1;
      toBeOfferVersion.prevVersionId = new OfferVersionId(offerId, 0).value;
      assert.deepStrictEqual(newOfferVersion, toBeOfferVersion);
      const toBeOffer = offer;
      toBeOffer.currentVersionId = newVersionOfferId.value;
      assert.deepStrictEqual(updatedOffer, toBeOffer);
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
      await offerOperations.addVersionedOffer(offerId, offer, offerVersion);
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

});
