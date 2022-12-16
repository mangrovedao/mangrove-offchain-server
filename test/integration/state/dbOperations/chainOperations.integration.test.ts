import assert from "assert";
import { before, describe, it } from "mocha";
import { ChainOperations } from "../../../../src/state/dbOperations/chainOperations";
import { ChainId, MangroveId } from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Chain Operations Integration test suite", () => {
  let chainOperations: ChainOperations;
  before(() => {
    chainOperations = new ChainOperations(prisma);
  });

  describe("getChainId", () => {
    it("mangrove==null", async () => {
      const mangroveId = new MangroveId(new ChainId(10), "abcd");

      let count = await prisma.mangrove.count();
      assert.strictEqual(count, 0, "No mangroves should have been created yet");
      await prisma.mangrove.create({
        data: {
          id: "id",
          chainId: 10,
          address: "address",
          currentVersionId: "0",
        },
      });
      count = await prisma.mangrove.count();
      assert.strictEqual(count, 1, "One mangrove should have been created");
      await assert.rejects(chainOperations.getChainId(mangroveId));
    });

    it("mangrove!=null", async () => {
      const mangroveId = new MangroveId(new ChainId(10), "abcd");

      let count = await prisma.mangrove.count();
      assert.strictEqual(count, 0, "No mangroves should have been created yet");
      await prisma.mangrove.create({
        data: {
          id: "abcd",
          chainId: 10,
          address: "address",
          currentVersionId: "0",
        },
      });
      count = await prisma.mangrove.count();
      assert.strictEqual(count, 1, "One mangrove should have been created");
      const chainId = await chainOperations.getChainId(mangroveId);
      assert.strictEqual(
        chainId.value,
        10,
        "Chain id must be the same as was use for creation"
      );
    });
  });

  describe("ensureChain", () => {
    beforeEach(async () => {
      await prisma.chain.create({ data: { id: 10, name: "mumbai" } });
    });

    it("chain==undefined", async () => {
      const chainId = new ChainId(20);
      assert.strictEqual(await prisma.chain.count(), 1);
      const chain = await chainOperations.ensureChain(chainId, "polygon");
      assert.strictEqual(await prisma.chain.count(), 2);
      assert.strictEqual(chain.id, 20);
      assert.strictEqual(chain.name, "polygon");
    });

    it("chain!=undefined", async () => {
      const chainId = new ChainId(10);
      assert.strictEqual(await prisma.chain.count(), 1);
      const chain = await chainOperations.ensureChain(chainId, "polygon");
      assert.strictEqual(await prisma.chain.count(), 1);
      assert.strictEqual(chain.id, 10);
      assert.strictEqual(chain.name, "mumbai");
    });
  });

});
