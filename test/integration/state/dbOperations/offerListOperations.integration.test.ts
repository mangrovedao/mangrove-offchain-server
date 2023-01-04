import * as prismaModel from "@prisma/client";
import assert from "assert";
import { before, describe } from "mocha";
import { OfferListingOperations } from "src/state/dbOperations/offerListOperations";
import {
  ChainId,
  MangroveId,
  OfferListingId,
  OfferListKey,
  OfferListingVersionId,
  TokenId
} from "src/state/model";
import { prisma } from "utils/test/mochaHooks";

describe("OfferList Operations Integration test suite", () => {
  let offerListingOperations: OfferListingOperations;
  before(() => {
    offerListingOperations = new OfferListingOperations(prisma);
  });

  const chainId = new ChainId(10);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const outboundTokenId = new TokenId(chainId, "outboundToken");
  const inboundTokenId = new TokenId(chainId, "inboundToken");
  const offerListKey: OfferListKey = {
    outboundToken: outboundTokenId.tokenAddress,
    inboundToken: inboundTokenId.tokenAddress,
  };
  const offerListingId = new OfferListingId(mangroveId, offerListKey);
  const offerListingVersionId = new OfferListingVersionId(offerListingId, 0);
  let offerListing: prismaModel.OfferListing;
  let offerListingVersion: prismaModel.OfferListingVersion;
  let outboundToken: prismaModel.Token;
  let inboundToken: prismaModel.Token;

  beforeEach(async () => {
    inboundToken = await prisma.token.create({
      data: {
        id: inboundTokenId.value,
        name: "inbound",
        address: "inbound",
        symbol: "i",
        decimals: 0,
        chainId: chainId.value,
      },
    });
    outboundToken = await prisma.token.create({
      data: {
        id: outboundTokenId.value,
        name: "outbound",
        address: "outbound",
        symbol: "o",
        decimals: 0,
        chainId: chainId.value,
      },
    });
    offerListing = await prisma.offerListing.create({
      data: {
        id: offerListingId.value,
        mangroveId: mangroveId.value,
        inboundTokenId: inboundTokenId.value,
        outboundTokenId: outboundTokenId.value,
        currentVersionId: offerListingVersionId.value,
      },
    });
    offerListingVersion = await prisma.offerListingVersion.create({
      data: {
        id: offerListingVersionId.value,
        offerListingId: offerListingId.value,
        txId: "txId",
        active: true,
        fee: "100",
        gasbase: 10,
        density: "10",
        versionNumber: offerListingVersionId.versionNumber,
      },
    });
  });

  describe("getOfferListTokens", () => {
    it("No offerList with that Id, offerListId", async () => {
      offerListKey.inboundToken = "noMatch";
      const noMatch = new OfferListingId(mangroveId, offerListKey);
      await assert.rejects(
        offerListingOperations.getOfferListTokens({ id: noMatch })
      );
    });

    it("get offerList, offerListId", async () => {
      const tokens = await offerListingOperations.getOfferListTokens({
        id: offerListingId,
      });
      assert.deepStrictEqual(tokens.inboundToken, inboundToken);
      assert.deepStrictEqual(tokens.outboundToken, outboundToken);
    });
    it("No offerList with that Id, mangroveOrder", async () => {
      offerListKey.inboundToken = "noMatch";
      const noMatch = new OfferListingId(mangroveId, offerListKey);
      await assert.rejects(
        offerListingOperations.getOfferListTokens({
          mangroveOrder: { offerListingId: noMatch.value },
        })
      );
    });

    it("get offerList, mangroveOrder", async () => {
      const tokens = await offerListingOperations.getOfferListTokens({
        mangroveOrder: { offerListingId: offerListingId.value },
      });
      assert.deepStrictEqual(tokens.inboundToken, inboundToken);
      assert.deepStrictEqual(tokens.outboundToken, outboundToken);
    });
  });

  describe("addVersionedOfferList", () => {
    it("Create new offerList and version", async () => {
      offerListKey.inboundToken = "newInbound";
      const newOfferListId = new OfferListingId(mangroveId, offerListKey);
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 1);
      await offerListingOperations.addVersionedOfferList(
        newOfferListId,
        "txId",
        (o) => (o.active = true)
      );
      assert.strictEqual(await prisma.offerListing.count(), 2);
      assert.strictEqual(await prisma.offerListingVersion.count(), 2);
      const newOfferList = await prisma.offerListing.findUnique({
        where: { id: newOfferListId.value },
      });
      assert.notDeepStrictEqual(newOfferList, null);
      const newOfferListVersionId = new OfferListingVersionId(newOfferListId, 0);
      assert.deepStrictEqual(newOfferList, {
        id: newOfferListId.value,
        mangroveId: newOfferListId.mangroveId.value,
        outboundTokenId: outboundTokenId.value,
        inboundTokenId: new TokenId(chainId, offerListKey.inboundToken).value,
        currentVersionId: newOfferListVersionId.value,
      });
      const newOfferListVersion = await prisma.offerListingVersion.findUnique({
        where: { id: newOfferListVersionId.value },
      });
      assert.notDeepStrictEqual(newOfferListVersion, null);
      assert.deepStrictEqual(newOfferListVersion, {
        id: newOfferListVersionId.value,
        offerListingId: newOfferListId.value,
        txId: "txId",
        versionNumber: 0,
        prevVersionId: null,
        active: true,
        density: null,
        gasbase: null,
        fee: null,
      });
    });

    it("Updates offerList and adds new version", async () => {
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 1);
      await offerListingOperations.addVersionedOfferList(
        offerListingId,
        "txId",
        (o) => (o.active = false)
      );
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 2);
      const newOfferList = await prisma.offerListing.findUnique({
        where: { id: offerListingId.value },
      });
      assert.notDeepStrictEqual(newOfferList, null);
      const newOfferListVersionId = new OfferListingVersionId(offerListingId, 1);
      offerListing.currentVersionId = newOfferListVersionId.value;
      assert.deepStrictEqual(newOfferList, offerListing);
      const newOfferListVersion = await prisma.offerListingVersion.findUnique({
        where: { id: newOfferListVersionId.value },
      });
      assert.notDeepStrictEqual(newOfferListVersion, null);
      offerListingVersion.active = false;
      offerListingVersion.prevVersionId = offerListingVersion.id;
      offerListingVersion.id = newOfferListVersionId.value;
      offerListingVersion.versionNumber = 1;
      assert.deepStrictEqual(newOfferListVersion, offerListingVersion);
    });

    it("Cant find current version", async () => {
      await prisma.offerListingVersion.deleteMany();
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 0);
      await assert.rejects(
        offerListingOperations.addVersionedOfferList(
          offerListingId,
          "txId",
          (o) => (o.active = false)
        )
      );
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 0);
    });
  });

  describe("deleteLatestOfferListVersion", () => {
    it("cant find offerList", async () => {
      offerListKey.inboundToken = "noMatch";
      const noMatch = new OfferListingId(mangroveId, offerListKey);
      await assert.rejects(
        offerListingOperations.deleteLatestOfferListingVersion(noMatch)
      );
    });

    it("No prevVersion, delete both", async () => {
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 1);
      await offerListingOperations.deleteLatestOfferListingVersion(offerListingId);
      assert.strictEqual(await prisma.offerListing.count(), 0);
      assert.strictEqual(await prisma.offerListingVersion.count(), 0);
    });

    it("Has prevVersion, delete only latest version", async () => {
      await offerListingOperations.addVersionedOfferList(
        offerListingId,
        "txId",
        (o) => (o.active = false)
      );
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 2);
      const oldVersion = await prisma.offerListing.findUnique({
        where: { id: offerListing.id },
      });
      await offerListingOperations.deleteLatestOfferListingVersion(offerListingId);
      assert.strictEqual(await prisma.offerListing.count(), 1);
      assert.strictEqual(await prisma.offerListingVersion.count(), 1);
      const currentVersion = await prisma.offerListing.findUnique({
        where: { id: offerListing.id },
      });
      assert.notDeepStrictEqual(currentVersion, oldVersion);
      assert.deepStrictEqual(currentVersion, offerListing);
    });
  });

  describe("getCurrentOfferListVersion", async () => {
    it("Cant find offerListing", async () => {
      const newOfferListId = new OfferListingId(mangroveId, { ...offerListKey, inboundToken:"noMatch" })
      await assert.rejects( offerListingOperations.getCurrentOfferListVersion(newOfferListId))
    })

    it("Cant find offerListingVersion", async () => {
      await prisma.offerListingVersion.deleteMany();
      await assert.rejects( offerListingOperations.getCurrentOfferListVersion(offerListingId))
    })

    it("Found current offerListing version", async () => {
      const found = await offerListingOperations.getCurrentOfferListVersion(offerListingId);
      assert.deepStrictEqual(found, offerListingVersion);
    })
  })

});
