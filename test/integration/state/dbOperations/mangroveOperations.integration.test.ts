import assert from "assert";
import { before, describe, it } from "mocha";
import { MangroveOperations } from "../../../../src/state/dbOperations/mangroveOperations";
import {
  ChainId,
  MangroveId,
  MangroveVersionId,
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";
import { Mangrove, MangroveVersion } from "@prisma/client";

describe("Mangrove Operations Integration test suite", () => {
  let mangroveOperations: MangroveOperations;
  before(() => {
    mangroveOperations = new MangroveOperations(prisma);
  });

  const chainId = new ChainId(123);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const mangroveVersionId = new MangroveVersionId(mangroveId, 0);
  let mangrove:Mangrove;
  let mangroveVersion:MangroveVersion;

  beforeEach(async () => {
    mangrove = await prisma.mangrove.create({
      data: {
        id: mangroveId.value,
        chainId: chainId.value,
        address: "address",
        currentVersionId: "mangroveId-0",
      },
    });
    mangroveVersion = await prisma.mangroveVersion.create({
      data: {
        id: mangroveVersionId.value,
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
      assert.strictEqual(await prisma.mangroveVersion.count(), 1);
      await mangroveOperations.addVersionedMangrove({
        id:newMangroveId,
        address:"address",
        txId:"txId"
    });
      assert.strictEqual(await prisma.mangrove.count(), 2);
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      const newMangrove = await prisma.mangrove.findUnique({
        where: { id: newMangroveId.value },
      });
      const newMangroveVersionId = new MangroveVersionId(newMangroveId,0);
      assert.deepStrictEqual(newMangrove, {
        id: newMangroveId.value,
        chainId: chainId.value,
        address: "address",
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
      await prisma.mangroveVersion.deleteMany();
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
      assert.strictEqual(await prisma.mangroveVersion.count(), 1);
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
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      const newMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const newMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: newMangrove?.currentVersionId },
      });
      assert.notDeepStrictEqual(oldMangrove, newMangrove);
      assert.strictEqual(oldMangrove?.currentVersionId, "mangroveId-0");
      assert.strictEqual(newMangrove?.currentVersionId, "mangroveId-1");
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
        await prisma.mangroveVersion.deleteMany();
        await assert.rejects( mangroveOperations.getCurrentMangroveVersion(mangrove));
    })

    it("Finds current version", async () => {
      const found = await mangroveOperations.getCurrentMangroveVersion(mangroveId);
      assert.deepStrictEqual( found, mangroveVersion);
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
      assert.strictEqual(await prisma.mangroveVersion.count(), 1);
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
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      const oldMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const oldMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: oldMangrove?.currentVersionId },
      });
      await mangroveOperations.deleteLatestMangroveVersion(mangroveId);
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 1);
      const newMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const newMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: newMangrove?.currentVersionId },
      });
      assert.notDeepStrictEqual(oldMangrove, newMangrove);
      assert.strictEqual(oldMangrove?.currentVersionId, "mangroveId-1");
      assert.strictEqual(newMangrove?.currentVersionId, "mangroveId-0");
      assert.notDeepStrictEqual(oldMangroveVersion, newMangroveVersion);
      assert.strictEqual(oldMangroveVersion?.dead, true);
      assert.strictEqual(newMangroveVersion?.dead, false);
    });
  });

});
