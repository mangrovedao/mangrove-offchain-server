import assert from "assert";
import { before, describe, it } from "mocha";
import { TokenOperations } from "../../../../src/state/dbOperations/tokenOperations";
import {
  ChainId,
  TokenId
} from "../../../../src/state/model";
import { prisma } from "../../../../src/utils/test/mochaHooks";

describe("Token Operations Integration test suite", () => {
  let tokenOperations: TokenOperations;
  before(() => {
    tokenOperations = new TokenOperations(prisma);
  });

  const chainId = new ChainId(10);
  const inboundTokenId = new TokenId(chainId, "inboundToken");


  beforeEach(async () => {
    await prisma.token.create({
      data: {
        id: inboundTokenId.value,
        chainId: chainId.value,
        address: "address",
        symbol: "i",
        name: "inbound",
        decimals: 10
      },
    });


  });

  describe("assertTokenExists", () => {
    it("Tokens doesn't exist", async () => {
      await assert.rejects( tokenOperations.assertTokenExists(new TokenId(chainId, "noMatch")));
    })
    it("Token does exist", async () => {
      await assert.doesNotReject( tokenOperations.assertTokenExists( inboundTokenId));
    })
  })

});
