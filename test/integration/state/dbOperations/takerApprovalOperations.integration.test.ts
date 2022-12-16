import assert from "assert";
import { before, describe, it } from "mocha";
import { TakerApprovalOperations } from "../../../../src/state/dbOperations/takerApprovalOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferListId,
  OfferListKey,
  OrderId,
  TakerApprovalId,
  TakerApprovalVersionId,
  TokenId
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Taker Approval Operations Integration test suite", () => {
  let takerApprovalOperations: TakerApprovalOperations;
  before(() => {
    takerApprovalOperations = new TakerApprovalOperations(prisma);
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
  const ownerId = new AccountId(chainId, "ownerAddress");
  const spenderId = new AccountId(chainId, "spenderAddress");
  const orderId = new OrderId(mangroveId, offerListKey, "order");
  const takerApprovalId = new TakerApprovalId(mangroveId, offerListKey, ownerId.address, spenderId.address)
  const takerApprovalVersionId = new TakerApprovalVersionId(takerApprovalId, 0);

  beforeEach(async () => {
    await prisma.takerApproval.create({
      data: {
        id: takerApprovalId.value,
        mangroveId: mangroveId.value,
        ownerId: ownerId.value,
        spenderId: spenderId.value,
        offerListId: offerListId.value,
        currentVersionId: takerApprovalVersionId.value,
      },
    });
    await prisma.takerApprovalVersion.create({
      data: {
        id: takerApprovalVersionId.value,
        takerApprovalId: takerApprovalId.value,
        txId: "txId",
        value: "1000",
        versionNumber: 0,
        prevVersionId: null,
      },
    });

  });

  describe("addVersionedTakerApproval", () => {
    it("Create new takerApproval and version, with order", async () => {
      const newTakerApprovalId = new TakerApprovalId(mangroveId, offerListKey, "owner", "spender");
      const newTakerApprovalVersionId = new TakerApprovalVersionId(newTakerApprovalId, 0);
      assert.strictEqual(await prisma.takerApproval.count(), 1);
      assert.strictEqual(await prisma.takerApprovalVersion.count(), 1);
      await takerApprovalOperations.addVersionedTakerApproval(newTakerApprovalId, "txId", (t) => t.value = "10", orderId);
      assert.strictEqual(await prisma.takerApproval.count(), 2);
      assert.strictEqual(await prisma.takerApprovalVersion.count(), 2);
      const newTakerApproval = await prisma.takerApproval.findUnique({ where: { id: newTakerApprovalId.value } });
      assert.deepStrictEqual(newTakerApproval, {
        id: newTakerApprovalId.value,
        mangroveId: newTakerApprovalId.mangroveId.value,
        ownerId: new AccountId(newTakerApprovalId.mangroveId.chainId, newTakerApprovalId.ownerAddress).value,
        spenderId: new AccountId(newTakerApprovalId.mangroveId.chainId, newTakerApprovalId.spenderAddress)
          .value,
        offerListId: new OfferListId(newTakerApprovalId.mangroveId, newTakerApprovalId.offerListKey).value,
        currentVersionId: newTakerApprovalVersionId.value,
      });
      const newTakerApprovalVersion =  await prisma.takerApprovalVersion.findUnique({where: {id: newTakerApproval.currentVersionId}})
      assert.deepStrictEqual( newTakerApprovalVersion, {
        id: newTakerApprovalVersionId.value,
        takerApprovalId: newTakerApprovalId.value,
        txId: "txId",
        parentOrderId: orderId.value,
        versionNumber: 0,
        prevVersionId: null,
        value: "10",
      } )
    });

    it("Create new takerApproval and version, without order", async () => {
      const newTakerApprovalId = new TakerApprovalId(mangroveId, offerListKey, "owner", "spender");
      const newTakerApprovalVersionId = new TakerApprovalVersionId(newTakerApprovalId, 0);
      assert.strictEqual(await prisma.takerApproval.count(), 1);
      assert.strictEqual(await prisma.takerApprovalVersion.count(), 1);
      await takerApprovalOperations.addVersionedTakerApproval(newTakerApprovalId, "txId", (t) => t.value = "10");
      assert.strictEqual(await prisma.takerApproval.count(), 2);
      assert.strictEqual(await prisma.takerApprovalVersion.count(), 2);
      const newTakerApproval = await prisma.takerApproval.findUnique({ where: { id: newTakerApprovalId.value } });
      assert.deepStrictEqual(newTakerApproval, {
        id: newTakerApprovalId.value,
        mangroveId: newTakerApprovalId.mangroveId.value,
        ownerId: new AccountId(newTakerApprovalId.mangroveId.chainId, newTakerApprovalId.ownerAddress).value,
        spenderId: new AccountId(newTakerApprovalId.mangroveId.chainId, newTakerApprovalId.spenderAddress)
          .value,
        offerListId: new OfferListId(newTakerApprovalId.mangroveId, newTakerApprovalId.offerListKey).value,
        currentVersionId: newTakerApprovalVersionId.value,
      });
      const newTakerApprovalVersion =  await prisma.takerApprovalVersion.findUnique({where: {id: newTakerApproval.currentVersionId}})
      assert.deepStrictEqual( newTakerApprovalVersion, {
        id: newTakerApprovalVersionId.value,
        takerApprovalId: newTakerApprovalId.value,
        txId: "txId",
        parentOrderId: null,
        versionNumber: 0,
        prevVersionId: null,
        value: "10",
      } )
    });

    it("Update takerApproval and create new version", async () => {
      const takerApproval = await prisma.takerApproval.findUnique({ where: { id: takerApprovalId.value } });
      const takerApprovalVersion =  await prisma.takerApprovalVersion.findUnique({where: {id: takerApproval?.currentVersionId}})
      if( !takerApproval || !takerApprovalVersion ) assert.fail();
      assert.strictEqual(await prisma.takerApproval.count(), 1);
      assert.strictEqual(await prisma.takerApprovalVersion.count(), 1);
      await takerApprovalOperations.addVersionedTakerApproval(takerApprovalId, "txId", (t) => t.value = "10", orderId);
      assert.strictEqual(await prisma.takerApproval.count(), 1);
      assert.strictEqual(await prisma.takerApprovalVersion.count(), 2);
      const updatedTakerApproval = await prisma.takerApproval.findUnique({ where: { id: takerApprovalId.value } });
      if( !updatedTakerApproval ) assert.fail();
      takerApproval.currentVersionId = new TakerApprovalVersionId(takerApprovalId, 1).value;
      assert.deepStrictEqual(updatedTakerApproval, takerApproval );
      const newTakerApprovalVersion =  await prisma.takerApprovalVersion.findUnique({where: {id: updatedTakerApproval.currentVersionId}})
      takerApprovalVersion.value = "10",
      takerApprovalVersion.versionNumber = 1;
      takerApprovalVersion.prevVersionId = new TakerApprovalVersionId(takerApprovalId, 0).value;
      takerApprovalVersion.id = new TakerApprovalVersionId(takerApprovalId, 1).value;
      assert.deepStrictEqual( newTakerApprovalVersion, takerApprovalVersion )
    });

    it("Cannot find current version", async () => {
      await prisma.takerApprovalVersion.deleteMany();
      await assert.rejects( takerApprovalOperations.addVersionedTakerApproval(takerApprovalId, "txId", (t) => t.value = "10", orderId) );
    })
  })

  describe("deleteLatestTakerApprovalVersion", () => {
    it("Cannot find takerApproval", async () => {
      await assert.rejects( takerApprovalOperations.deleteLatestTakerApprovalVersion( new TakerApprovalId( mangroveId, offerListKey, "noMatch", "noMatch")));
    })
    it("Cannot find takerApproval", async () => {
      await prisma.takerApprovalVersion.deleteMany()
      await assert.rejects( takerApprovalOperations.deleteLatestTakerApprovalVersion( takerApprovalId));
    })
    it("No prevVersion, delete both takerApproval and version", async () => {
      assert.strictEqual( await prisma.takerApproval.count(), 1);
      assert.strictEqual( await prisma.takerApprovalVersion.count(), 1);
      await takerApprovalOperations.deleteLatestTakerApprovalVersion(takerApprovalId);
      assert.strictEqual( await prisma.takerApproval.count(), 0);
      assert.strictEqual( await prisma.takerApprovalVersion.count(), 0);
    })
    it("Has prevVersion, update takerApproval and delete version", async () => {
      await takerApprovalOperations.addVersionedTakerApproval(takerApprovalId, "txId", (t) => t.value = "1212" );
      assert.strictEqual( await prisma.takerApproval.count(), 1);
      assert.strictEqual( await prisma.takerApprovalVersion.count(), 2);
      const oldTakerApproval = await prisma.takerApproval.findUnique({where: { id: takerApprovalId.value}});
      if( !oldTakerApproval  ) assert.fail();
      await takerApprovalOperations.deleteLatestTakerApprovalVersion(takerApprovalId);
      assert.strictEqual( await prisma.takerApproval.count(), 1);
      assert.strictEqual( await prisma.takerApprovalVersion.count(), 1);
      const updatedTakerApproval = await prisma.takerApproval.findUnique({where: { id: takerApprovalId.value}});
      assert.notDeepStrictEqual( updatedTakerApproval, oldTakerApproval);
      oldTakerApproval.currentVersionId = new TakerApprovalVersionId( takerApprovalId, 0).value;
      assert.deepStrictEqual( updatedTakerApproval, oldTakerApproval);

    })
  })

});
