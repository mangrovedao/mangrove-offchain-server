import { PrismaClient } from "@prisma/client";
import assert from "assert";
import { after, before, describe, it } from "mocha";
import { TokenOperations } from "../../../../src/state/dbOperations/tokenOperations";
import {
  ChainId,
  MangroveId,
  MangroveVersionId,
  TakerApprovalId,
  OfferListKey,
  TokenId,
  AccountId,
  OfferListId,
  TakerApprovalVersionId,
  OrderId
} from "../../../../src/state/model";
import { clearPostgres } from "../../../util/prismaUtils";

describe("Mangrove Operations Integration test suite", () => {
  let prisma: PrismaClient;
  let tokenOperations: TokenOperations;
  before(() => {
    prisma = new PrismaClient();
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



  afterEach(async () => {
    await clearPostgres();
  });

  after(() => {
    prisma.$disconnect();
  });
});
