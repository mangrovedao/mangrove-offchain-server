import { Account, Kandel, Token, TokenBalance, TokenBalanceVersion, Transaction } from "@prisma/client";
import assert from "assert";
import { before, describe } from "mocha";
import { KandelOperations } from "src/state/dbOperations/kandelOperations";
import { TokenBalanceOperations } from "src/state/dbOperations/tokenBalanceOperations";
import {
  AccountId,
  ChainId,
  KandelId,
  MangroveId,
  OfferListKey,
  OrderId,
  TakenOfferId,
  TokenBalanceId,
  TokenBalanceVersionId,
  TokenId
} from "src/state/model";
import { prisma } from "utils/test/mochaHooks";

describe("Token Balance Operations Integration test suite", () => {
  let tokenBalanceOperations: TokenBalanceOperations;
  let kandelOperations: KandelOperations;

  before(() => {
    tokenBalanceOperations = new TokenBalanceOperations(prisma);
    kandelOperations = new KandelOperations(prisma);
  });

  const chainId = new ChainId(10);
  const tokenId = new TokenId(chainId, "token");
  const reserveId = new AccountId(chainId, "reserveAddress");
  const baseId = new TokenId(chainId,"baseAddress");
  const quoteId = new TokenId(chainId,"quoteAddress");
  const tokenBalanceId = new TokenBalanceId({accountId:reserveId, tokenId, stream: "stream"});
  const tokenBalanceVersionId = new TokenBalanceVersionId({tokenBalanceId, versionNumber:0})
  const mangroveId = new MangroveId(chainId, "mangroveAddress");
  const kandelId = new KandelId(chainId, "kandelAddress");
  const offerListKey: OfferListKey = {
    outboundToken: baseId.tokenAddress,
    inboundToken: quoteId.tokenAddress,
  };
  
  let tx:Transaction;
  let token:Token;
  let reserve:Account;
  let kandel:Kandel;
  let tokenBalance:TokenBalance;
  let tokenBalanceVersion:TokenBalanceVersion;

  beforeEach(async () => {

    tx = await prisma.transaction.create({
      data: {
        id: "txId",
        chainId: chainId.value,
        txHash: "txHash",
        from: "from",
        blockNumber: 0,
        blockHash: "blockHash",
        time: new Date()
      }
    })

    token = await prisma.token.create({
      data: {
        id: tokenId.value,
        chainId: chainId.value,
        address: tokenId.tokenAddress,
        symbol: "t",
        name: "token",
        decimals: 0,
      },
    });

    reserve = await prisma.account.create( {
      data: {
        id: reserveId.value,
        chainId: chainId.value,
        address: reserveId.address
      }
    })

    kandel = await prisma.kandel.create( {
      data: {
        id: kandelId.value,
        mangroveId: mangroveId.value,
        baseId: baseId.value,
        quoteId: quoteId.value,
        reserveId: reserveId.value,
        type: "Kandel",
        currentVersionId: ""
      }
    })

    tokenBalance = await prisma.tokenBalance.create( {
      data: {
        id: tokenBalanceId.value,
        accountId: reserveId.value,
        tokenId: tokenId.value,
        stream: "stream",
        currentVersionId: tokenBalanceVersionId.value
      }
    })

    tokenBalanceVersion = await prisma.tokenBalanceVersion.create({
      data: {
        id: tokenBalanceVersionId.value,
        txId: tx.id,
        tokenBalanceId: tokenBalanceId.value,
        deposit: "20",
        withdrawal: "10",
        send: "0",
        received: "1",
        balance: "11",
        versionNumber: 0
      }
    })


  });


  describe(TokenBalanceOperations.prototype.addTokenBalanceVersion.name, () => {
    it("Has existing reserve account + has existing token balance  ", async () => {
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 1);
      assert.strictEqual(await prisma.account.count(), 1);
      const { updatedOrNewTokenBalance,newVersion} = await tokenBalanceOperations.addTokenBalanceVersion({tokenBalanceId, txId:tx.id, updateFunc:(version) => { version.deposit="10"; version.balance="10" }});
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 2);
      assert.strictEqual(await prisma.account.count(), 1);
      assert.deepStrictEqual( {
        ...tokenBalanceVersion, 
        deposit:"10", 
        balance:"10",
        versionNumber: 1,
        prevVersionId: tokenBalanceVersion.id,
        id: new TokenBalanceVersionId({tokenBalanceId, versionNumber:1}).value
       }, newVersion )
      assert.deepStrictEqual({
        ...tokenBalance,
        currentVersionId:new TokenBalanceVersionId({tokenBalanceId, versionNumber:1}).value
      },  updatedOrNewTokenBalance)
    })

    it("Has no existing reserve account + has no existing token balance  ", async () => {
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 1);
      assert.strictEqual(await prisma.account.count(), 1);
      const newReserveId = new AccountId(chainId, "reserveAddress2")
      const newTokenBalanceId = new TokenBalanceId({accountId:newReserveId, tokenId, stream: "stream"})
      const { updatedOrNewTokenBalance,newVersion} = await tokenBalanceOperations.addTokenBalanceVersion({tokenBalanceId: newTokenBalanceId, txId:tx.id });
      assert.strictEqual(await prisma.tokenBalance.count(), 2);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 2);
      assert.strictEqual(await prisma.account.count(), 2);
      assert.deepStrictEqual( {
        id: new TokenBalanceVersionId({tokenBalanceId:newTokenBalanceId, versionNumber:0}).value,
        txId: tx.id,
        tokenBalanceId: newTokenBalanceId.value,
        deposit:"0", 
        withdrawal: "0",
        send: "0",
        received: "0",
        balance:"0",
        versionNumber: 0,
        prevVersionId: null,
       }, newVersion )
       assert.deepStrictEqual({
        id: newTokenBalanceId.value,
        accountId: newReserveId.value,
        tokenId: tokenId.value,
        stream: "stream",
        currentVersionId: new TokenBalanceVersionId({tokenBalanceId:newTokenBalanceId, versionNumber:0}).value
      },  updatedOrNewTokenBalance)
    })

    it("Has existing reserve account + has no existing token balance  ", async () => {
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 1);
      assert.strictEqual(await prisma.account.count(), 1);
      const newTokenId = new TokenId(chainId, "token2");
      const newTokenBalanceId = new TokenBalanceId({accountId:reserveId, tokenId:newTokenId,stream: "stream"})
      const { updatedOrNewTokenBalance,newVersion} = await tokenBalanceOperations.addTokenBalanceVersion({tokenBalanceId: newTokenBalanceId, txId:tx.id });
      assert.strictEqual(await prisma.tokenBalance.count(), 2);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 2);
      assert.strictEqual(await prisma.account.count(), 1);
      assert.deepStrictEqual( {
        id: new TokenBalanceVersionId({tokenBalanceId:newTokenBalanceId, versionNumber:0}).value,
        txId: tx.id,
        tokenBalanceId: newTokenBalanceId.value,
        deposit:"0", 
        withdrawal: "0",
        send: "0",
        received: "0",
        balance:"0",
        versionNumber: 0,
        prevVersionId: null,
       }, newVersion )
       assert.deepStrictEqual({
        id: newTokenBalanceId.value,
        accountId: reserveId.value,
        tokenId: newTokenId.value,
        stream: "stream",
        currentVersionId: new TokenBalanceVersionId({tokenBalanceId:newTokenBalanceId, versionNumber:0}).value
      },  updatedOrNewTokenBalance)
    })
   
  });

  describe(TokenBalanceOperations.prototype.getTokenBalance.name,  () => {
    it("Cant find tokenBalance", async () => {
      const tokenBalanceId = new TokenBalanceId({accountId:kandelId, tokenId:baseId, stream: "stream"});
      await assert.rejects( tokenBalanceOperations.getTokenBalance( tokenBalanceId) );
    })

    it("Has token balance", async () => {
      const tokenBalanceId = new TokenBalanceId({accountId:reserveId, tokenId:tokenId,  stream: "stream"});
      const thisTokenBalance = await tokenBalanceOperations.getTokenBalance( tokenBalanceId );
      assert.deepStrictEqual( tokenBalance, thisTokenBalance )
    })
  })

  describe(TokenBalanceOperations.prototype.getCurrentTokenBalanceVersion.name,  () => {
    it("No current version", async () => {
      await assert.rejects( tokenBalanceOperations.getCurrentTokenBalanceVersion({ ...tokenBalance, currentVersionId: "noMatch"}) );
    })

    it("Has current version", async () => {
      const thisTokenBalance =  await tokenBalanceOperations.getCurrentTokenBalanceVersion( tokenBalance);
      assert.deepStrictEqual( tokenBalanceVersion, thisTokenBalance )
    })
  })

  describe(TokenBalanceOperations.prototype.getTokenBalanceId.name, () => {
    it("With id", () => {
      const id =  tokenBalanceOperations.getTokenBalanceId( tokenBalanceId);
      assert.strictEqual(tokenBalanceId.value, id)
    })
    it("With TokenBalance", () => {
      const id =  tokenBalanceOperations.getTokenBalanceId( tokenBalance);
      assert.strictEqual(tokenBalance.id, id)
    })
  })

  describe(TokenBalanceOperations.prototype.deleteLatestTokenBalanceVersion.name,  () => {
    it("No token balance", async () => {

      await assert.rejects( tokenBalanceOperations.deleteLatestTokenBalanceVersion( new TokenBalanceId({ accountId: new AccountId(chainId, "noMatch"), tokenId:tokenId, stream: "stream"})) );
    })
    it("No prevVersion", async () => {
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 1);
      await tokenBalanceOperations.deleteLatestTokenBalanceVersion( tokenBalanceId );
      assert.strictEqual(await prisma.tokenBalance.count(), 0);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 0);
    })

    it("Has prevVersion", async () => {
      await tokenBalanceOperations.addTokenBalanceVersion({ tokenBalanceId: tokenBalanceId, txId: "txId2", updateFunc: (v) => {v.deposit="10"; v.balance= "30"; } })
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 2);
      await tokenBalanceOperations.deleteLatestTokenBalanceVersion( tokenBalanceId );
      assert.strictEqual(await prisma.tokenBalance.count(), 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count(), 1);
    })
  })

  describe(TokenBalanceOperations.prototype.createTokenBalanceEvent.name, async () => {
    it( "With kandelId and taken offerId", async () => {
      assert.strictEqual(await prisma.tokenBalanceEvent.count(), 0);
      const takenOfferId = new TakenOfferId( new OrderId(mangroveId, offerListKey, "proximaId"), 2);
      const event = await tokenBalanceOperations.createTokenBalanceEvent(reserveId, tokenId, tokenBalanceVersion, takenOfferId)
      assert.strictEqual(await prisma.tokenBalanceEvent.count(), 1);
      const eventInDb = await prisma.tokenBalanceEvent.findUnique({where: { id: event.id}})
      assert.deepStrictEqual( event, eventInDb )
      assert.strictEqual(event.takenOfferId, takenOfferId.value)

    } )

    it( "With kandel and no taken offerId", async () => {
      assert.strictEqual(await prisma.tokenBalanceEvent.count(), 0);
      const event = await tokenBalanceOperations.createTokenBalanceEvent(reserveId, tokenId, tokenBalanceVersion )
      assert.strictEqual(await prisma.tokenBalanceEvent.count(), 1);
      const eventInDb = await prisma.tokenBalanceEvent.findUnique({where: { id: event.id}})
      assert.deepStrictEqual( event, eventInDb )
      assert.strictEqual( event.takenOfferId, null)

    } )
  })

  it(TokenBalanceOperations.prototype.createTokenBalanceDepositEvent.name, async () => {
    const tokenBalanceEvent = await tokenBalanceOperations.createTokenBalanceEvent(reserveId, tokenId, tokenBalanceVersion)
    assert.strictEqual(await prisma.tokenBalanceEvent.count(), 1);
    assert.strictEqual(await prisma.tokenBalanceDepositEvent.count(), 0);
    const depositEvent = await tokenBalanceOperations.createTokenBalanceDepositEvent( tokenBalanceEvent, "100", kandelId.value );
    assert.strictEqual(await prisma.tokenBalanceEvent.count(), 1);
    assert.strictEqual(await prisma.tokenBalanceDepositEvent.count(), 1);
    const eventInDb = await prisma.tokenBalanceDepositEvent.findUnique({where: { id: depositEvent.id}})
    assert.deepStrictEqual( depositEvent, eventInDb )
    
  })

  it(TokenBalanceOperations.prototype.createTokenBalanceWithdrawalEvent.name, async () => {
    const tokenBalanceEvent = await tokenBalanceOperations.createTokenBalanceEvent(reserveId,  tokenId, tokenBalanceVersion)
    assert.strictEqual(await prisma.tokenBalanceEvent.count(), 1);
    assert.strictEqual(await prisma.tokenBalanceWithdrawalEvent.count(), 0);
    const withdrawEvent = await tokenBalanceOperations.createTokenBalanceWithdrawalEvent( tokenBalanceEvent, "100", kandelId.value  );
    assert.strictEqual(await prisma.tokenBalanceEvent.count(), 1);
    assert.strictEqual(await prisma.tokenBalanceWithdrawalEvent.count(), 1);
    const eventInDb = await prisma.tokenBalanceWithdrawalEvent.findUnique({where: { id: withdrawEvent.id}})
    assert.deepStrictEqual( withdrawEvent, eventInDb )
  })

});
