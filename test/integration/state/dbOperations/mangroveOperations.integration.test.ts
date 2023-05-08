import assert from "assert";
import { before, describe, it } from "mocha";
import { MangroveOperations } from "src/state/dbOperations/mangroveOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  MangroveVersionId,
  OfferListingId,
} from "src/state/model";
import { prisma } from "utils/test/mochaHooks";
import { Mangrove, MangroveVersion } from "@prisma/client";

describe("Mangrove Operations Integration test suite", () => {
  let mangroveOperations: MangroveOperations;
  before(() => {
    mangroveOperations = new MangroveOperations(prisma);
  });

  const chainId = new ChainId(123);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const mangroveVersionId0 = new MangroveVersionId(mangroveId, 0);
  const mangroveVersionId1 = new MangroveVersionId(mangroveId, 1);
  let mangrove:Mangrove;
  let mangroveVersion0:MangroveVersion;
  let mangroveVersion1:MangroveVersion;

  beforeEach(async () => {
    mangrove = await prisma.mangrove.create({
      data: {
        id: mangroveId.value,
        chainId: chainId.value,
        address: "address",
        currentVersionId: mangroveVersionId1.value,
      },
    });
    mangroveVersion0 = await prisma.mangroveVersion.create({
      data: {
        id: mangroveVersionId0.value,
        mangroveId: mangroveId.value,
        txId: "txId",
        governance: "gov",
        monitor: "mon",
        vault: "vault",
        useOracle: true,
        notify: true,
        gasmax: 100,
        gasprice: 10,
        dead: false,
        versionNumber: 0,
        prevVersionId: null,
      },
    });
    mangroveVersion1 = await prisma.mangroveVersion.create({
      data: {
        id: mangroveVersionId1.value,
        mangroveId: mangroveId.value,
        txId: "txId",
        governance: "gov",
        monitor: "mon",
        vault: "vault",
        useOracle: true,
        notify: true,
        gasmax: 100,
        gasprice: 10,
        dead: false,
        versionNumber: 1,
        prevVersionId: mangroveVersionId0.value,
      },
    });
  });


  describe("addVersionedMangrove", () => {

    it("Does not exit, missing address", async () =>{
      const newMangroveId = new MangroveId(chainId, "10");
      await assert.rejects( mangroveOperations.addVersionedMangrove({
        id:newMangroveId,
        txId:"txId"
    }) );
    })

    it("Does not exist, will be created", async () => {
      const newMangroveId = new MangroveId(chainId, "10");
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      await mangroveOperations.addVersionedMangrove({
        id:newMangroveId,
        address:"address2",
        txId:"txId"
    });
      assert.strictEqual(await prisma.mangrove.count(), 2);
      assert.strictEqual(await prisma.mangroveVersion.count(), 3);
      const newMangrove = await prisma.mangrove.findUnique({
        where: { id: newMangroveId.value },
      });
      const newMangroveVersionId = new MangroveVersionId(newMangroveId,0);
      assert.deepStrictEqual(newMangrove, {
        id: newMangroveId.value,
        chainId: chainId.value,
        address: "address2",
        currentVersionId: newMangroveVersionId.value,
      });
      const newMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: newMangrove.currentVersionId },
      });
      assert.deepStrictEqual(newMangroveVersion, {
        id: newMangroveVersionId.value,
        mangroveId: newMangroveId.value,
        txId: "txId",
        versionNumber: 0,
        prevVersionId: null,
        governance: null,
        monitor: null,
        vault: null,
        useOracle: null,
        notify: null,
        gasmax: null,
        gasprice: null,
        dead: null,
      });
    });

    it("Mangrove exists, no update function given", async () => {
      await assert.rejects( mangroveOperations.addVersionedMangrove({
        id:mangroveId,
        txId:"txId",
    }) );
    })

    it("Mangrove current version does not exist", async () => {
      await prisma.mangrove.update({
        where: { id: mangroveId.value },
        data: { 
          currentVersionId: "noMatch",
         }, 
      });
      await assert.rejects(
        mangroveOperations.addVersionedMangrove({
          id: mangroveId,
          txId: "txId",
          updateFunc: (m) => (m.dead = true),
    })
      );
    });

    it("Updates Mangrove and Mangrove version", async () => {
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      const oldMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const oldMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: oldMangrove?.currentVersionId },
      });
      await mangroveOperations.addVersionedMangrove({
        id: mangroveId,
        txId: "txId",
        updateFunc: (m) => (m.dead = true),
    });
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 3);
      const newMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const newMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: newMangrove?.currentVersionId },
      });
      assert.notDeepStrictEqual(oldMangrove, newMangrove);
      assert.strictEqual(oldMangrove?.currentVersionId, "mangroveid-1");
      assert.strictEqual(newMangrove?.currentVersionId, "mangroveid-2");
      assert.notDeepStrictEqual(oldMangroveVersion, newMangroveVersion);
      assert.strictEqual(oldMangroveVersion?.dead, false);
      assert.strictEqual(newMangroveVersion?.dead, true);
    });
  });

  describe("getCurrentMangroveVersion", () => {
    it("Cant find mangrove", async () => {
      const newMangroveId = new MangroveId(chainId, "2");
      await assert.rejects( mangroveOperations.getCurrentMangroveVersion(newMangroveId));
    })

    it("Cant find current version", async () => {
      await prisma.mangrove.update({
        where: { id: mangroveId.value },
        data: { 
          currentVersionId: "noMatch",
         }, 
      });
        await assert.rejects( mangroveOperations.getCurrentMangroveVersion(mangrove));
    })

    it("Finds current version", async () => {
      const found = await mangroveOperations.getCurrentMangroveVersion(mangroveId);
      assert.deepStrictEqual( found, mangroveVersion1);
    })
  })

  describe("deleteLatestMangroveVersion", () => {
    it("Mangrove does not exist", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId2");
      await assert.rejects(
        mangroveOperations.deleteLatestMangroveVersion(mangroveId)
      );
    });

    it("No prevVersion", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId");
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      await mangroveOperations.deleteLatestMangroveVersion(mangroveId);
      await mangroveOperations.deleteLatestMangroveVersion(mangroveId);
      assert.strictEqual(await prisma.mangrove.count(), 0);
      assert.strictEqual(await prisma.mangroveVersion.count(), 0);
    });

    it("Has prevVersion", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId");
      await mangroveOperations.addVersionedMangrove({
        id: mangroveId,
        txId: "txId",
        updateFunc: (m) => (m.dead = true),
    });
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 3);
      const oldMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const oldMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: oldMangrove?.currentVersionId },
      });
      await mangroveOperations.deleteLatestMangroveVersion(mangroveId);
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      const newMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const newMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: newMangrove?.currentVersionId },
      });
      assert.notDeepStrictEqual(oldMangrove, newMangrove);
      assert.strictEqual(oldMangrove?.currentVersionId, "mangroveid-2");
      assert.strictEqual(newMangrove?.currentVersionId, "mangroveid-1");
      assert.notDeepStrictEqual(oldMangroveVersion, newMangroveVersion);
      assert.strictEqual(oldMangroveVersion?.dead, true);
      assert.strictEqual(newMangroveVersion?.dead, false);
    });
  });

  it(MangroveOperations.prototype.createMangroveEvent.name, async () => {
    const mangroveEventCount=  await prisma.mangroveEvent.count();  
    const mangroveEvent = await mangroveOperations.createMangroveEvent({ mangroveId, txId: "txId" });
    assert.strictEqual( await prisma.mangroveEvent.count()-mangroveEventCount, 1);  
    assert.deepStrictEqual( mangroveEvent.mangroveId, mangroveId.value)
    assert.deepStrictEqual( mangroveEvent.txId, "txId")
  })


  it(MangroveOperations.prototype.createOfferWriteEvent.name, async () => {
    const offerWriteCount=  await prisma.offerWriteEvent.count();  
    const offer = {
      gives: "10",
      wants: "6",
      gasprice: 4,
      gasreq: 5,
      prev: 1
    };
    const offerListingId =new OfferListingId(mangroveId, { outboundToken: "outbound", inboundToken:"inbound"});
    const makerId = new AccountId(chainId, "makerAddress");
    const offerWriteEvent = await mangroveOperations.createOfferWriteEvent({ 
      offerListingId: offerListingId, 
      offerVersion: {id: "offerVersionId"}, 
      makerId: makerId, 
      mangroveEvent: {id: "mangroveEventId"}, 
      event:{ 
        offer: offer
      } });
    assert.strictEqual( await prisma.offerWriteEvent.count()- offerWriteCount, 1);  
    assert.deepStrictEqual( offerWriteEvent, { 
      id:offerWriteEvent.id,
      offerListingId: offerListingId.value,
      offerVersionId: "offerVersionId",
      makerId: makerId.value,
      mangroveEventId: "mangroveEventId",
      ...offer
    })
  })

  it(MangroveOperations.prototype.createOfferRetractEvent.name, async () => {
    const offerRetractCount = await prisma.offerRetractEvent.count();
    const offerListingId = new OfferListingId(mangroveId, { outboundToken: "outbound", inboundToken:"inbound"});
    const offerRetractEvent = await mangroveOperations.createOfferRetractEvent({
      offerListingId: offerListingId,
      offerVersion: { id: "offerVersionId" },
      mangroveEvent: { id: "mangroveEventId" },
    })
    assert.strictEqual(await prisma.offerRetractEvent.count() - offerRetractCount, 1);
    assert.deepStrictEqual(offerRetractEvent, {
      id: offerRetractEvent.id,
      offerListingId: offerListingId.value,
      offerVersionId: "offerVersionId",
      mangroveEventId: "mangroveEventId",
    });

  })
});
