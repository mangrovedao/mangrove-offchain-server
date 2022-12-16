import { MakerBalanceVersion } from "@prisma/client";
import assert from "assert";
import { before, describe, it } from "mocha";
import { MakerBalanceOperations } from "../../../../src/state/dbOperations/makerBalanceOperations";
import {
  AccountId,
  ChainId,
  MakerBalanceId,
  MakerBalanceVersionId,
  MangroveId,
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Maker Balance Operations Integration test suite", () => {
  let makerBalanceOperations: MakerBalanceOperations;
  before(() => {
    makerBalanceOperations = new MakerBalanceOperations(prisma);
  });

  beforeEach(async () => {
    await prisma.makerBalance.create({
      data: {
        id: "mangroveId-address",
        mangroveId: "mangroveId",
        makerId: "10-address",
        currentVersionId: "mangroveId-address-0",
      },
    });
    await prisma.makerBalanceVersion.create({
      data: {
        id: "mangroveId-address-0",
        makerBalanceId: "mangroveId-address",
        txId: "txId",
        versionNumber: 0,
        prevVersionId: null,
        balance: "0",
      },
    });
  });

  describe("addVersionedMakerBalance", () => {
    it("makerBalance===null", async () => {
      const makerBalanceId = new MakerBalanceId(
        new MangroveId(new ChainId(10), "mangroveId"),
        "noMatch"
      );

      assert.strictEqual(await prisma.makerBalance.count(), 1);
      await makerBalanceOperations.addVersionedMakerBalance(
        makerBalanceId,
        "txId",
        (m) => (m.balance = "10")
      );
      assert.strictEqual(await prisma.makerBalance.count(), 2);
      const makerBalance = await prisma.makerBalance.findUnique({
        where: { id: makerBalanceId.value },
      });
      assert.strictEqual(makerBalance?.id, makerBalanceId.value);
      assert.strictEqual(
        makerBalance.mangroveId,
        makerBalanceId.mangroveId.value
      );
      assert.strictEqual(
        makerBalance.makerId,
        new AccountId(makerBalanceId.mangroveId.chainId, makerBalanceId.address)
          .value
      );
      const makerBalanceVersionId = new MakerBalanceVersionId(
        makerBalanceId,
        0
      );
      assert.strictEqual(
        makerBalance.currentVersionId,
        makerBalanceVersionId.value
      );
      const makerBalanceVersion = await prisma.makerBalanceVersion.findUnique({
        where: { id: makerBalance.currentVersionId },
      });
      assert.strictEqual(makerBalanceVersion?.id, makerBalanceVersionId.value);
      assert.strictEqual(
        makerBalanceVersion.makerBalanceId,
        makerBalanceId.value
      );
      assert.strictEqual(makerBalanceVersion.txId, "txId");
      assert.strictEqual(makerBalanceVersion.versionNumber, 0);
      assert.strictEqual(makerBalanceVersion.prevVersionId, null);
      assert.strictEqual(makerBalanceVersion.balance, "10");
    });

    it("makerBalance!=null", async () => {
      const makerBalanceId = new MakerBalanceId(
        new MangroveId(new ChainId(10), "mangroveId"),
        "address"
      ); // matches the one from beforeEach

      assert.strictEqual(await prisma.makerBalance.count(), 1);
      await makerBalanceOperations.addVersionedMakerBalance(
        makerBalanceId,
        "txId",
        (m) => (m.balance = "10")
      );
      assert.strictEqual(await prisma.makerBalance.count(), 1);
      const makerBalance = await prisma.makerBalance.findUnique({
        where: { id: makerBalanceId.value },
      });
      assert.strictEqual(makerBalance?.id, makerBalanceId.value);
      assert.strictEqual(
        makerBalance.mangroveId,
        makerBalanceId.mangroveId.value
      );
      assert.strictEqual(
        makerBalance.makerId,
        new AccountId(makerBalanceId.mangroveId.chainId, makerBalanceId.address)
          .value
      );
      const makerBalanceVersionId = new MakerBalanceVersionId(
        makerBalanceId,
        1
      );
      assert.strictEqual(
        makerBalance.currentVersionId,
        makerBalanceVersionId.value
      );
      const makerBalanceVersion = await prisma.makerBalanceVersion.findUnique({
        where: { id: makerBalance.currentVersionId },
      });
      assert.strictEqual(makerBalanceVersion?.id, makerBalanceVersionId.value);
      assert.strictEqual(
        makerBalanceVersion.makerBalanceId,
        makerBalanceId.value
      );
      assert.strictEqual(makerBalanceVersion.txId, "txId");
      assert.strictEqual(makerBalanceVersion.versionNumber, 1);
      assert.strictEqual(
        makerBalanceVersion.prevVersionId,
        new MakerBalanceVersionId(makerBalanceId, 0).value
      );
      assert.strictEqual(makerBalanceVersion.balance, "10");
    });
  });

  describe("getCurrentMakerBalanceVersion", () => {
    it("currentVersion not found", async () => {
      const makerBalance = {
        id: "noMatch",
        mangroveId: "mangroveId",
        makerId: "10-address",
        currentVersionId: "noMatch",
      };

      await assert.rejects(
        async () =>
          await makerBalanceOperations.getCurrentMakerBalanceVersion(
            makerBalance
          )
      );
    });

    it("currentVersion found", async () => {
      const makerBalance = {
        id: "mangroveId-address",
        mangroveId: "mangroveId",
        makerId: "10-address",
        currentVersionId: "mangroveId-address-0",
      };

      const currentVersion =
        await makerBalanceOperations.getCurrentMakerBalanceVersion(
          makerBalance
        );
      const expected: MakerBalanceVersion = {
        id: "mangroveId-address-0",
        makerBalanceId: "mangroveId-address",
        txId: "txId",
        versionNumber: 0,
        prevVersionId: null,
        balance: "0",
      };
      assert.deepStrictEqual(expected, currentVersion);
    });
  });

  describe("deleteLatestMakerBalanceVersion", () => {
    it("MakerBalance not found", async () => {
      const makerBalanceId = new MakerBalanceId(
        new MangroveId(new ChainId(10), "abcd"),
        "address"
      );
      await assert.rejects(
        makerBalanceOperations.deleteLatestMakerBalanceVersion(makerBalanceId)
      );
    });

    it("No prevVersion", async () => {
      const makerBalanceId = new MakerBalanceId(
        new MangroveId(new ChainId(10), "mangroveId"),
        "address"
      );
      assert.strictEqual(await prisma.makerBalance.count(), 1);
      assert.strictEqual(await prisma.makerBalanceVersion.count(), 1);
      await makerBalanceOperations.deleteLatestMakerBalanceVersion(
        makerBalanceId
      );
      assert.strictEqual(await prisma.makerBalance.count(), 0);
      assert.strictEqual(await prisma.makerBalanceVersion.count(), 0);
    });

    it("Has prevVersion", async () => {
      const makerBalanceId = new MakerBalanceId(
        new MangroveId(new ChainId(10), "mangroveId"),
        "address"
      );
      await makerBalanceOperations.addVersionedMakerBalance(
        makerBalanceId,
        "txId",
        (m) => (m.balance = "10")
      );
      const oldMakerBalance = await prisma.makerBalance.findUnique({
        where: { id: makerBalanceId.value },
      });
      assert.strictEqual(
        oldMakerBalance?.currentVersionId,
        "mangroveId-address-1"
      );
      assert.strictEqual(await prisma.makerBalance.count(), 1);
      assert.strictEqual(await prisma.makerBalanceVersion.count(), 2);
      await makerBalanceOperations.deleteLatestMakerBalanceVersion(
        makerBalanceId
      );
      assert.strictEqual(await prisma.makerBalance.count(), 1);
      assert.strictEqual(await prisma.makerBalanceVersion.count(), 1);
      const newMakerBalance = await prisma.makerBalance.findUnique({
        where: { id: makerBalanceId.value },
      });
      assert.notDeepStrictEqual(newMakerBalance, oldMakerBalance);
      assert.strictEqual(
        newMakerBalance?.currentVersionId,
        "mangroveId-address-0"
      );
    });
  });


});
