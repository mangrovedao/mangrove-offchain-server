import assert from "assert";
import { before, describe, it } from "mocha";
import { MangroveOperations } from "../../../../src/state/dbOperations/mangroveOperations";
import {
  ChainId,
  MangroveId,
  MangroveVersionId,
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Mangrove Operations Integration test suite", () => {
  let mangroveOperations: MangroveOperations;
  before(() => {
    mangroveOperations = new MangroveOperations(prisma);
  });

  beforeEach(async () => {
    await prisma.mangrove.create({
      data: {
        id: "mangroveId",
        chainId: 10,
        address: "address",
        currentVersionId: "mangroveId-0",
      },
    });
    await prisma.mangroveVersion.create({
      data: {
        id: "mangroveId-0",
        mangroveId: "mangroveId",
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

  describe("createMangrove", () => {
    it("Already exists", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId");
      await assert.rejects(
        mangroveOperations.createMangrove(
          mangroveId,
          chainId,
          "address",
          "txId"
        )
      );
    });

    it("Does not exist, will be created", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId2");
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 1);
      await mangroveOperations.createMangrove(
        mangroveId,
        chainId,
        "address",
        "txId"
      );
      assert.strictEqual(await prisma.mangrove.count(), 2);
      assert.strictEqual(await prisma.mangroveVersion.count(), 2);
      const mangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const mangroveVersionId = new MangroveVersionId(mangroveId, 0);
      assert.deepStrictEqual(mangrove, {
        id: mangroveId.value,
        chainId: chainId.value,
        address: "address",
        currentVersionId: mangroveVersionId.value,
      });
      const mangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: mangrove.currentVersionId },
      });
      assert.deepStrictEqual(mangroveVersion, {
        id: mangroveVersionId.value,
        mangroveId: mangroveId.value,
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
  });

  describe("addVersionedMangrove", () => {
    it("Mangrove does not exist", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId2");
      await assert.rejects(
        mangroveOperations.addVersionedMangrove(
          mangroveId,
          (m) => (m.dead = true),
          "txId"
        )
      );
    });

    it("Mangrove current version does not exist", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId");
      await prisma.mangroveVersion.deleteMany();
      await assert.rejects(
        mangroveOperations.addVersionedMangrove(
          mangroveId,
          (m) => (m.dead = true),
          "txId"
        )
      );
    });

    it("Updates Mangrove and Mangrove version", async () => {
      const chainId = new ChainId(10);
      const mangroveId = new MangroveId(chainId, "mangroveId");
      assert.strictEqual(await prisma.mangrove.count(), 1);
      assert.strictEqual(await prisma.mangroveVersion.count(), 1);
      const oldMangrove = await prisma.mangrove.findUnique({
        where: { id: mangroveId.value },
      });
      const oldMangroveVersion = await prisma.mangroveVersion.findUnique({
        where: { id: oldMangrove?.currentVersionId },
      });
      await mangroveOperations.addVersionedMangrove(
        mangroveId,
        (m) => (m.dead = true),
        "txId"
      );
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
      await mangroveOperations.addVersionedMangrove(
        mangroveId,
        (m) => (m.dead = true),
        "txId"
      );
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
