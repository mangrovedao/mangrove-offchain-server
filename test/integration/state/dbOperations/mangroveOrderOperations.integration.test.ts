import * as prismaModel from "@prisma/client";
import assert from "assert";
import { before, describe, it } from "mocha";
import { MangroveOrderOperations } from "src/state/dbOperations/mangroveOrderOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  MangroveOrderId,
  MangroveOrderVersionId,
  OfferId,
  OfferListingId,
  OfferListKey,
  OfferListingVersionId,
  OrderId,
  TokenId
} from "src/state/model";
import { prisma } from "utils/test/mochaHooks";

describe("Mangrove Order Operations Integration test suite", () => {
  let mangroveOrderOperations: MangroveOrderOperations;
  before(() => {
    mangroveOrderOperations = new MangroveOrderOperations(prisma);
  });

  const chainId = new ChainId(10);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const outboundTokenId = new TokenId(chainId, "outboundToken");
  const inboundTokenId = new TokenId(chainId, "inboundToken");
  const offerListKey: OfferListKey = {
    outboundToken: outboundTokenId.tokenAddress,
    inboundToken: inboundTokenId.tokenAddress,
  };
  const offerId = new OfferId(mangroveId, {inboundToken:offerListKey.outboundToken, outboundToken: offerListKey.inboundToken}, 1);
  const offerListingId = new OfferListingId(mangroveId, offerListKey);
  const offerListVersionId = new OfferListingVersionId(offerListingId, 0);
  const mangroveOrderId = new MangroveOrderId(
    mangroveId,
    offerListKey,
    "mangroveOrderId",
  );
  const stratId = new AccountId(chainId, "stratId");
  const mangroveOrderVersionId = new MangroveOrderVersionId({
    mangroveOrderId: mangroveOrderId,
    versionNumber: 0,
  });
  const orderId = new OrderId(mangroveId, offerListKey, "order");
  const takerId = new AccountId(chainId, "taker");
  let mangroveOrder: prismaModel.MangroveOrder;
  let mangroveOrderVersion: prismaModel.MangroveOrderVersion;

  beforeEach(async () => {
    await prisma.token.create({
      data: {
        id: inboundTokenId.value,
        chainId: chainId.value,
        address: inboundTokenId.tokenAddress,
        symbol: "i",
        name: "inbound",
        decimals: 0,
      },
    });

    await prisma.token.create({
      data: {
        id: outboundTokenId.value,
        chainId: chainId.value,
        address: outboundTokenId.tokenAddress,
        symbol: "o",
        name: "outbound",
        decimals: 0,
      },
    });

    await prisma.offerListing.create({
      data: {
        id: offerListingId.value,
        mangroveId: mangroveId.value,
        inboundTokenId: inboundTokenId.value,
        outboundTokenId: outboundTokenId.value,
        currentVersionId: offerListVersionId.value,
      },
    });

    await prisma.offerListingVersion.create({
      data: {
        id: offerListVersionId.value,
        offerListingId: offerListingId.value,
        txId: "txId",
        active: true,
        fee: "100",
        gasbase: 10,
        density: "10",
        versionNumber: 0,
      },
    });

    await prisma.order.create({
      data: {
        id: orderId.value,
        txId: "txId",
        proximaId: orderId.proximaId,
        mangroveId: mangroveId.value,
        offerListingId: offerListingId.value,
        takerId: takerId.value,
        takerGot: "49.5",
        takerGotNumber: 49.5,
        takerGave: "25",
        takerGaveNumber: 25,
        totalFee: "0.5",
        totalFeeNumber: 0.5,
        bounty: "1",
        bountyNumber: 1,
      },
    });

    mangroveOrder = await prisma.mangroveOrder.create({
      data: {
        id: mangroveOrderId.value,
        proximaId: mangroveOrderId.proximaId,
        mangroveId: mangroveId.value,
        stratId: stratId.value,
        offerListingId: offerListingId.value,
        takerId: takerId.value,
        orderId: orderId.value,
        restingOrderId: offerId.value,
        restingOrder: true,
        hasRestingOrder: true,
        fillOrKill: true,
        fillWants: true,
        takerWants: "100",
        takerWantsNumber: 100,
        takerGives: "50",
        takerGivesNumber: 50,
        totalFee: "0.5",
        totalFeeNumber: 0.5,
        bounty: "1",
        bountyNumber: 1,
        currentVersionId: mangroveOrderVersionId.value,
      },
    });
    mangroveOrderVersion = await prisma.mangroveOrderVersion.create({
      data: {
        id: mangroveOrderVersionId.value,
        mangroveOrderId: mangroveOrderId.value,
        txId: "txId",
        expiryDate: new Date(2022,1,1),
        versionNumber: 0,
        prevVersionId: null,
      },
    });
  });

  describe("addMangroveOrderVersionFromOfferId", () => {
    it("updates to expiryDate", async () => {
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
      const oldMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId.value },
      });
      const oldMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: oldMangroveOrder?.currentVersionId },
        });
      await mangroveOrderOperations.addMangroveOrderVersionFromOfferId(
        offerId,
        "txId",
        (m) => (m.expiryDate = new Date(2023, 1, 1))
      );
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 2);
      const newMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId.value },
      });
      const newMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: newMangroveOrder?.currentVersionId },
        });
      assert.notDeepStrictEqual(oldMangroveOrder, newMangroveOrder);
      const newVersionId = new MangroveOrderVersionId({
        mangroveOrderId: mangroveOrderId,
        versionNumber: 1,
      });
      assert.strictEqual(
        oldMangroveOrder?.currentVersionId,
        mangroveOrderVersionId.value
      );
      assert.strictEqual(
        newMangroveOrder?.currentVersionId,
        newVersionId.value
      );
      assert.notDeepStrictEqual(
        oldMangroveOrderVersion,
        newMangroveOrderVersion
      );
      assert.deepStrictEqual(oldMangroveOrderVersion?.expiryDate, new Date(2022, 1, 1));
      assert.deepStrictEqual(newMangroveOrderVersion?.expiryDate, new Date( 2023, 1, 1));
    });
  });

  describe("getCurrentMangroveOrderVersion", () => {
    it("No MangroveOrder, with mangroveOrder", async () => {
      mangroveOrder.id = "noMatch";
      await assert.rejects(
        mangroveOrderOperations.getCurrentMangroveOrderVersion(
          mangroveOrder,
        )
      );
    });

    it("No current version, with mangroveOrder", async () => {
      await prisma.mangroveOrder.update({where: { id: mangroveOrderId.value}, data: { currentVersionId: "noMatch"} })
      await assert.rejects(
        mangroveOrderOperations.getCurrentMangroveOrderVersion(
          mangroveOrder,
        )
      );
    });

    it("Has current version, with mangroveOrder", async () => {
      const currentVersion =
        await mangroveOrderOperations.getCurrentMangroveOrderVersion(
          mangroveOrder,
        );
      assert.strictEqual(currentVersion.id, mangroveOrder.currentVersionId);
      assert.strictEqual(currentVersion.mangroveOrderId, mangroveOrderId.value);
    });

    it("No MangroveOrder, with mangroveOrderId", async () => {
      const noMatch = new MangroveOrderId(
        mangroveId,
        offerListKey,
        "noMatch",
      );
      await assert.rejects(
        mangroveOrderOperations.getCurrentMangroveOrderVersion(
          noMatch,
        )
      );
    });

    it("No current version, with mangroveOrderId", async () => {
      await prisma.mangroveOrder.update({where: { id: mangroveOrderId.value}, data: { currentVersionId: "noMatch"} })
      await assert.rejects(
        mangroveOrderOperations.getCurrentMangroveOrderVersion(
          mangroveOrderId,
        )
      );
    });

    it("Has current version, with mangroveOrderId", async () => {
      const currentVersion =
        await mangroveOrderOperations.getCurrentMangroveOrderVersion(
          mangroveOrderId,
        );
      assert.strictEqual(currentVersion.id, mangroveOrder.currentVersionId);
      assert.strictEqual(currentVersion.mangroveOrderId, mangroveOrderId.value);
    });
  });

  describe("addMangroveOrderVersion", () => {

    it("No MangroveOrder, missing initial values", async () => {
      const mangroveOrderId2 = new MangroveOrderId(mangroveId, offerListKey, "mangroveOrder2");
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
      await assert.rejects(mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId2, "txId", (m) => m));
    })

    it("No MangroveOrder, adds new and version", async () => {
      const mangroveOrderId2 = new MangroveOrderId(mangroveId, offerListKey, "mangroveOrder2");
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
      const orderId2 = new OrderId(mangroveId, offerListKey, "order2");
      await mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId2, "txId", (m) => m, {...mangroveOrder, orderId: orderId2.value });
      const newMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId2.value },
      });
      const newMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: newMangroveOrder?.currentVersionId },
        });

      const newVersionId = new MangroveOrderVersionId({ mangroveOrderId: mangroveOrderId2, versionNumber: 0 });
      assert.deepStrictEqual(newMangroveOrder, {
        ...mangroveOrder,
        id: mangroveOrderId2.value, 
        orderId: orderId2.value,
        mangroveId: mangroveOrderId2.mangroveId.value, 
        currentVersionId: newVersionId.value, 
        proximaId: mangroveOrderId2.proximaId, 
        offerListingId: new OfferListingId(mangroveOrderId2.mangroveId, mangroveOrderId2.offerListKey).value
      });
      assert.deepStrictEqual(newMangroveOrderVersion, {
        id: newVersionId.value,
        txId: "txId",
        mangroveOrderId: mangroveOrderId2.value,
        expiryDate: new Date("0"),
        versionNumber: 0,
        prevVersionId: null
      })
    })

    it("Has version, creates new version", async () => {
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
      const oldMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId.value },
      });
      const oldMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: oldMangroveOrder?.currentVersionId },
        });
      await mangroveOrderOperations.addMangroveOrderVersion(
        mangroveOrderId,
        "txId",
        (m) => m.expiryDate = new Date(2023,1,1)
      );
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 2);
      const newMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId.value },
      });
      const newMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: newMangroveOrder?.currentVersionId },
        });
      assert.notDeepStrictEqual(oldMangroveOrder, newMangroveOrder);
      const newVersionId = new MangroveOrderVersionId({
        mangroveOrderId: mangroveOrderId,
        versionNumber: 1,
      });
      assert.strictEqual(
        oldMangroveOrder?.currentVersionId,
        mangroveOrderVersionId.value
      );
      assert.strictEqual(
        newMangroveOrder?.currentVersionId,
        newVersionId.value
      );
      assert.notDeepStrictEqual(
        oldMangroveOrderVersion,
        newMangroveOrderVersion
      );
      assert.deepStrictEqual(oldMangroveOrderVersion?.expiryDate, new Date(2022, 1, 1));
      assert.deepStrictEqual(newMangroveOrderVersion?.expiryDate, new Date( 2023, 1, 1));
    });
  });

  describe("deleteLatestMangroveOrderVersionUsingOfferId", () => {
    it("deletes", async () => {
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
      await mangroveOrderOperations.deleteLatestMangroveOrderVersionUsingOfferId(
        offerId
      );
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 0);
    });
  });

  describe("deleteLatestVersionOfMangroveOrder", () => {
    it("MangroveOrder does not exist", async () => {
      const mangroveOrderId2 = new MangroveOrderId(
        mangroveId,
        offerListKey,
        "noMatch",
      );
      await assert.rejects(
        mangroveOrderOperations.deleteLatestVersionOfMangroveOrder(
          mangroveOrderId2
        )
      );
    });

    it("MangroveOrderVersion deleted", async () => {
      await mangroveOrderOperations.addMangroveOrderVersion(
        mangroveOrderId,
        "txId",
        (m) => m.expiryDate = new Date(2023,1,1)
      );
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 2);
      const oldMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId.value },
      });
      const deletedMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: oldMangroveOrder?.currentVersionId },
        });
      await mangroveOrderOperations.deleteLatestVersionOfMangroveOrder(
        mangroveOrderId
      );
      assert.strictEqual(await prisma.mangroveOrder.count(), 1);
      assert.strictEqual(await prisma.mangroveOrderVersion.count(), 1);
      const newMangroveOrder = await prisma.mangroveOrder.findUnique({
        where: { id: mangroveOrderId.value },
      });
      const currentMangroveOrderVersion =
        await prisma.mangroveOrderVersion.findUnique({
          where: { id: newMangroveOrder?.currentVersionId },
        });
      assert.notDeepStrictEqual(oldMangroveOrder, newMangroveOrder);
      const deletedVersionId = new MangroveOrderVersionId({
        mangroveOrderId: mangroveOrderId,
        versionNumber: 1,
      });
      assert.strictEqual(
        oldMangroveOrder?.currentVersionId,
        deletedVersionId.value
      );
      assert.strictEqual(
        newMangroveOrder?.currentVersionId,
        mangroveOrderVersionId.value
      );
      assert.notDeepStrictEqual(
        deletedMangroveOrderVersion,
        currentMangroveOrderVersion
      );
      assert.deepStrictEqual(deletedMangroveOrderVersion?.expiryDate, new Date(2023, 1, 1));
      assert.deepStrictEqual(currentMangroveOrderVersion?.expiryDate, new Date( 2022, 1, 1));
    });
  });




  describe("getMangroveIdByStratId", () => {
    it("finds MangroveOrder", async () => {
      assert.strictEqual((await mangroveOrderOperations.getMangroveIdByStratId(stratId))?.value, mangroveId.value);
    })
    it("does not find MangroveOrder", async () => {
      assert.strictEqual(await mangroveOrderOperations.getMangroveIdByStratId(new AccountId(chainId, "noMatch")), null);
    })
  })

  it(MangroveOrderOperations.prototype.createMangroveOrderSetExpiryDateEvent.name, async () => {
    const mangroveOrderSetExpiryEventCount = await prisma.mangroveOrderSetExpiryEvent.count();
    const mangroveOrderSetExpiryEvent = await mangroveOrderOperations.createMangroveOrderSetExpiryDateEvent({ mangroveOrderVersion: { id: "versionId"}, event: { date: new Date(2023, 1, 1).getTime() } } );
    assert.strictEqual(await prisma.mangroveOrderSetExpiryEvent.count(), mangroveOrderSetExpiryEventCount + 1);
    assert.deepStrictEqual(mangroveOrderSetExpiryEvent, {
      id: mangroveOrderSetExpiryEvent.id,
      mangroveOrderVersionId: "versionId",
      expiryDate: new Date(2023, 1, 1),
    })
  })

});
