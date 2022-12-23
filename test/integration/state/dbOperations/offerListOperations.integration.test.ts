import * as prismaModel from "@prisma/client";
import assert from "assert";
import { before, describe } from "mocha";
import { OfferListOperations } from "../../../../src/state/dbOperations/offerListOperations";
import {
  ChainId,
  MangroveId,
  OfferListId,
  OfferListKey,
  OfferListVersionId,
  TokenId
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("OfferList Operations Integration test suite", () => {
  let offerListOperations: OfferListOperations;
  before(() => {
    offerListOperations = new OfferListOperations(prisma);
  });

  const chainId = new ChainId(10);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const outboundTokenId = new TokenId(chainId, "outboundToken");
  const inboundTokenId = new TokenId(chainId, "inboundToken");
  const offerListKey: OfferListKey = {
    outboundToken: outboundTokenId.tokenAddress,
    inboundToken: inboundTokenId.tokenAddress,
  };
  const offerListId = new OfferListId(mangroveId, offerListKey);
  const offerListVersionId = new OfferListVersionId(offerListId, 0);
  let offerList: prismaModel.OfferList;
  let offerListVersion: prismaModel.OfferListVersion;
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
    offerList = await prisma.offerList.create({
      data: {
        id: offerListId.value,
        mangroveId: mangroveId.value,
        inboundTokenId: inboundTokenId.value,
        outboundTokenId: outboundTokenId.value,
        currentVersionId: offerListVersionId.value,
      },
    });
    offerListVersion = await prisma.offerListVersion.create({
      data: {
        id: offerListVersionId.value,
        offerListId: offerListId.value,
        txId: "txId",
        active: true,
        fee: "100",
        gasbase: 10,
        density: "10",
        versionNumber: offerListVersionId.versionNumber,
      },
    });
  });

  describe("getOfferListTokens", () => {
    it("No offerList with that Id, offerListId", async () => {
      offerListKey.inboundToken = "noMatch";
      const noMatch = new OfferListId(mangroveId, offerListKey);
      await assert.rejects(
        offerListOperations.getOfferListTokens({ id: noMatch })
      );
    });

    it("get offerList, offerListId", async () => {
      const tokens = await offerListOperations.getOfferListTokens({
        id: offerListId,
      });
      assert.deepStrictEqual(tokens.inboundToken, inboundToken);
      assert.deepStrictEqual(tokens.outboundToken, outboundToken);
    });
    it("No offerList with that Id, mangroveOrder", async () => {
      offerListKey.inboundToken = "noMatch";
      const noMatch = new OfferListId(mangroveId, offerListKey);
      await assert.rejects(
        offerListOperations.getOfferListTokens({
          mangroveOrder: { offerListId: noMatch.value },
        })
      );
    });

    it("get offerList, mangroveOrder", async () => {
      const tokens = await offerListOperations.getOfferListTokens({
        mangroveOrder: { offerListId: offerListId.value },
      });
      assert.deepStrictEqual(tokens.inboundToken, inboundToken);
      assert.deepStrictEqual(tokens.outboundToken, outboundToken);
    });
  });

  describe("addVersionedOfferList", () => {
    it("Create new offerList and version", async () => {
      offerListKey.inboundToken = "newInbound";
      const newOfferListId = new OfferListId(mangroveId, offerListKey);
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 1);
      await offerListOperations.addVersionedOfferList(
        newOfferListId,
        "txId",
        (o) => (o.active = true)
      );
      assert.strictEqual(await prisma.offerList.count(), 2);
      assert.strictEqual(await prisma.offerListVersion.count(), 2);
      const newOfferList = await prisma.offerList.findUnique({
        where: { id: newOfferListId.value },
      });
      assert.notDeepStrictEqual(newOfferList, null);
      const newOfferListVersionId = new OfferListVersionId(newOfferListId, 0);
      assert.deepStrictEqual(newOfferList, {
        id: newOfferListId.value,
        mangroveId: newOfferListId.mangroveId.value,
        outboundTokenId: outboundTokenId.value,
        inboundTokenId: new TokenId(chainId, offerListKey.inboundToken).value,
        currentVersionId: newOfferListVersionId.value,
      });
      const newOfferListVersion = await prisma.offerListVersion.findUnique({
        where: { id: newOfferListVersionId.value },
      });
      assert.notDeepStrictEqual(newOfferListVersion, null);
      assert.deepStrictEqual(newOfferListVersion, {
        id: newOfferListVersionId.value,
        offerListId: newOfferListId.value,
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
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 1);
      await offerListOperations.addVersionedOfferList(
        offerListId,
        "txId",
        (o) => (o.active = false)
      );
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 2);
      const newOfferList = await prisma.offerList.findUnique({
        where: { id: offerListId.value },
      });
      assert.notDeepStrictEqual(newOfferList, null);
      const newOfferListVersionId = new OfferListVersionId(offerListId, 1);
      offerList.currentVersionId = newOfferListVersionId.value;
      assert.deepStrictEqual(newOfferList, offerList);
      const newOfferListVersion = await prisma.offerListVersion.findUnique({
        where: { id: newOfferListVersionId.value },
      });
      assert.notDeepStrictEqual(newOfferListVersion, null);
      offerListVersion.active = false;
      offerListVersion.prevVersionId = offerListVersion.id;
      offerListVersion.id = newOfferListVersionId.value;
      offerListVersion.versionNumber = 1;
      assert.deepStrictEqual(newOfferListVersion, offerListVersion);
    });

    it("Cant find current version", async () => {
      await prisma.offerListVersion.deleteMany();
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 0);
      await assert.rejects(
        offerListOperations.addVersionedOfferList(
          offerListId,
          "txId",
          (o) => (o.active = false)
        )
      );
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 0);
    });
  });

  describe("deleteLatestOfferListVersion", () => {
    it("cant find offerList", async () => {
      offerListKey.inboundToken = "noMatch";
      const noMatch = new OfferListId(mangroveId, offerListKey);
      await assert.rejects(
        offerListOperations.deleteLatestOfferListVersion(noMatch)
      );
    });

    it("No prevVersion, delete both", async () => {
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 1);
      await offerListOperations.deleteLatestOfferListVersion(offerListId);
      assert.strictEqual(await prisma.offerList.count(), 0);
      assert.strictEqual(await prisma.offerListVersion.count(), 0);
    });

    it("Has prevVersion, delete only latest version", async () => {
      await offerListOperations.addVersionedOfferList(
        offerListId,
        "txId",
        (o) => (o.active = false)
      );
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 2);
      const oldVersion = await prisma.offerList.findUnique({
        where: { id: offerList.id },
      });
      await offerListOperations.deleteLatestOfferListVersion(offerListId);
      assert.strictEqual(await prisma.offerList.count(), 1);
      assert.strictEqual(await prisma.offerListVersion.count(), 1);
      const currentVersion = await prisma.offerList.findUnique({
        where: { id: offerList.id },
      });
      assert.notDeepStrictEqual(currentVersion, oldVersion);
      assert.deepStrictEqual(currentVersion, offerList);
    });
  });

  describe("getCurrentOfferListVersion", async () => {
    it("Cant find offerList", async () => {
      const newOfferListId = new OfferListId(mangroveId, { ...offerListKey, inboundToken:"noMatch" })
      await assert.rejects( offerListOperations.getCurrentOfferListVersion(newOfferListId))
    })

    it("Cant find offerListVersion", async () => {
      await prisma.offerListVersion.deleteMany();
      await assert.rejects( offerListOperations.getCurrentOfferListVersion(offerListId))
    })

    it("Found current offerList version", async () => {
      const found = await offerListOperations.getCurrentOfferListVersion(offerListId);
      assert.deepStrictEqual(found, offerListVersion);
    })
  })

});
