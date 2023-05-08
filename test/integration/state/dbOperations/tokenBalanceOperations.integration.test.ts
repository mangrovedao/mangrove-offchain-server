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
  const tokenBalanceId1 = new TokenBalanceId({accountId:reserveId, tokenId, stream: "stream1"});
  const baseTokenBalanceId1 = new TokenBalanceId({accountId:reserveId, tokenId:baseId, stream: "stream1"});
  const baseTokenBalanceId2 = new TokenBalanceId({accountId:reserveId, tokenId:baseId, stream: "stream2"});
  const quoteTokenBalanceId1 = new TokenBalanceId({accountId:reserveId, tokenId:quoteId, stream: "stream1"});
  const quoteTokenBalanceId2 = new TokenBalanceId({accountId:reserveId, tokenId:quoteId, stream: "stream2"});
  const tokenBalanceVersionId1 = new TokenBalanceVersionId({tokenBalanceId: tokenBalanceId1, versionNumber:0})
  const baseTokenBalance1VersionId1 = new TokenBalanceVersionId({tokenBalanceId: baseTokenBalanceId1, versionNumber:0})
  const baseTokenBalance1VersionId2 = new TokenBalanceVersionId({tokenBalanceId: baseTokenBalanceId1, versionNumber:1})
  const quoteTokenBalance1VersionId1 = new TokenBalanceVersionId({tokenBalanceId: quoteTokenBalanceId1, versionNumber:0})
  const quoteTokenBalance1VersionId2 = new TokenBalanceVersionId({tokenBalanceId: quoteTokenBalanceId1, versionNumber:1})
  const baseTokenBalance2VersionId1 = new TokenBalanceVersionId({tokenBalanceId: baseTokenBalanceId2, versionNumber:0})
  const baseTokenBalance2VersionId2 = new TokenBalanceVersionId({tokenBalanceId: baseTokenBalanceId2, versionNumber:1})
  const quoteTokenBalance2VersionId1 = new TokenBalanceVersionId({tokenBalanceId: quoteTokenBalanceId2, versionNumber:0})
  const quoteTokenBalance2VersionId2 = new TokenBalanceVersionId({tokenBalanceId: quoteTokenBalanceId2, versionNumber:1})
  const mangroveId = new MangroveId(chainId, "mangroveAddress");
  const kandelId = new KandelId(chainId, "kandelAddress");
  const offerListKey: OfferListKey = {
    outboundToken: baseId.tokenAddress,
    inboundToken: quoteId.tokenAddress,
  };
  
  let tx1:Transaction;
  let tx2:Transaction;
  let tx3:Transaction;
  let token:Token;
  let reserve:Account;
  let kandel:Kandel;
  let tokenBalance1:TokenBalance;
  let tokenBalanceVersion:TokenBalanceVersion;

  beforeEach(async () => {

    tx1 = await prisma.transaction.create({
      data: {
        id: "txId1",
        chainId: chainId.value,
        txHash: "txHash1",
        from: "from",
        blockNumber: 0,
        blockHash: "blockHash",
        time: new Date(2023,1,1)
      }
    })

    tx2 = await prisma.transaction.create({
      data: {
        id: "txId2",
        chainId: chainId.value,
        txHash: "txHash2",
        from: "from",
        blockNumber: 0,
        blockHash: "blockHash",
        time: new Date(2023,5,1)
      }
    })

    tx3 = await prisma.transaction.create({
      data: {
        id: "txId3",
        chainId: chainId.value,
        txHash: "txHash3",
        from: "from",
        blockNumber: 0,
        blockHash: "blockHash",
        time: new Date(2023,8,1)
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

    tokenBalance1 = await prisma.tokenBalance.create( {
      data: {
        id: tokenBalanceId1.value,
        accountId: reserveId.value,
        tokenId: tokenId.value,
        stream: tokenBalanceId1.params.stream,
        currentVersionId: tokenBalanceVersionId1.value
      }
    })

    await prisma.tokenBalance.create( {
      data: {
        id: baseTokenBalanceId1.value,
        accountId: reserveId.value,
        tokenId: baseId.value,
        stream: baseTokenBalanceId1.params.stream,
        currentVersionId: baseTokenBalance1VersionId2.value
      }
    })

    await prisma.tokenBalance.create( {
      data: {
        id: baseTokenBalanceId2.value,
        accountId: reserveId.value,
        tokenId: baseId.value,
        stream: baseTokenBalanceId2.params.stream,
        currentVersionId: baseTokenBalance2VersionId2.value
      }
    })

    await prisma.tokenBalance.create( {
      data: {
        id: quoteTokenBalanceId1.value,
        accountId: reserveId.value,
        tokenId: quoteId.value,
        stream: quoteTokenBalanceId1.params.stream,
        currentVersionId: quoteTokenBalance1VersionId2.value
      }
    })

    await prisma.tokenBalance.create( {
      data: {
        id: quoteTokenBalanceId2.value,
        accountId: reserveId.value,
        tokenId: quoteId.value,
        stream: quoteTokenBalanceId2.params.stream,
        currentVersionId: quoteTokenBalance2VersionId2.value
      }
    })

    tokenBalanceVersion = await prisma.tokenBalanceVersion.create({
      data: {
        id: tokenBalanceVersionId1.value,
        txId: tx1.id,
        tokenBalanceId: tokenBalanceId1.value,
        deposit: "20",
        withdrawal: "10",
        send: "0",
        received: "1",
        balance: "11",
        versionNumber: 0
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: baseTokenBalance1VersionId1.value,
        txId: tx1.id,
        tokenBalanceId: baseTokenBalanceId1.value,
        deposit: "20",
        withdrawal: "10",
        send: "7",
        received: "1",
        balance: "11",
        versionNumber: 0
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: baseTokenBalance1VersionId2.value,
        txId: tx2.id,
        tokenBalanceId: baseTokenBalanceId1.value,
        deposit: "20",
        withdrawal: "10",
        send: "8",
        received: "3",
        balance: "15",
        versionNumber: 1
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: baseTokenBalance2VersionId1.value,
        txId: tx2.id,
        tokenBalanceId: baseTokenBalanceId2.value,
        deposit: "20",
        withdrawal: "10",
        send: "5",
        received: "2",
        balance: "16",
        versionNumber: 0
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: baseTokenBalance2VersionId2.value,
        txId: tx3.id,
        tokenBalanceId: baseTokenBalanceId2.value,
        deposit: "20",
        withdrawal: "10",
        send: "6",
        received: "7",
        balance: "12",
        versionNumber: 1
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: quoteTokenBalance1VersionId1.value,
        txId: tx1.id,
        tokenBalanceId: quoteTokenBalanceId1.value,
        deposit: "20",
        withdrawal: "10",
        send: "3",
        received: "1",
        balance: "11",
        versionNumber: 0
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: quoteTokenBalance1VersionId2.value,
        txId: tx3.id,
        tokenBalanceId: quoteTokenBalanceId1.value,
        deposit: "20",
        withdrawal: "10",
        send: "4",
        received: "3",
        balance: "15",
        versionNumber: 1
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: quoteTokenBalance2VersionId1.value,
        txId: tx2.id,
        tokenBalanceId: quoteTokenBalanceId2.value,
        deposit: "20",
        withdrawal: "10",
        send: "1",
        received: "2",
        balance: "16",
        versionNumber: 0
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: quoteTokenBalance2VersionId2.value,
        txId: tx2.id,
        tokenBalanceId: quoteTokenBalanceId2.value,
        deposit: "20",
        withdrawal: "10",
        send: "2",
        received: "7",
        balance: "12",
        versionNumber: 1
      }
    })


  });


  describe(TokenBalanceOperations.prototype.addTokenBalanceVersion.name, () => {
    it("Has existing reserve account + has existing token balance  ", async () => {
      const tokenBalanceCount =  await prisma.tokenBalance.count();
      const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count();
      const accountCount =  await prisma.account.count();
      const { updatedOrNewTokenBalance,newVersion} = await tokenBalanceOperations.addTokenBalanceVersion({tokenBalanceId: tokenBalanceId1, txId:tx1.id, updateFunc:(version) => { version.deposit="10"; version.balance="10" }});
      assert.strictEqual(await prisma.tokenBalance.count()-tokenBalanceCount, 0);
      assert.strictEqual(await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, 1);
      assert.strictEqual(await prisma.account.count() - accountCount, 0);
      assert.deepStrictEqual( {
        ...tokenBalanceVersion, 
        deposit:"10", 
        balance:"10",
        versionNumber: 1,
        prevVersionId: tokenBalanceVersion.id,
        id: new TokenBalanceVersionId({tokenBalanceId: tokenBalanceId1, versionNumber:1}).value
       }, newVersion )
      assert.deepStrictEqual({
        ...tokenBalance1,
        currentVersionId:new TokenBalanceVersionId({tokenBalanceId: tokenBalanceId1, versionNumber:1}).value
      },  updatedOrNewTokenBalance)
    })

    it("Has no existing reserve account + has no existing token balance  ", async () => {
      const tokenBalanceCount =  await prisma.tokenBalance.count();
      const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count();
      const accountCount =  await prisma.account.count();
      const newReserveId = new AccountId(chainId, "reserveAddress2")
      const newTokenBalanceId = new TokenBalanceId({accountId:newReserveId, tokenId, stream: "stream"})
      const { updatedOrNewTokenBalance,newVersion} = await tokenBalanceOperations.addTokenBalanceVersion({tokenBalanceId: newTokenBalanceId, txId:tx1.id });
      assert.strictEqual(await prisma.tokenBalance.count()-tokenBalanceCount, 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, 1);
      assert.strictEqual(await prisma.account.count() - accountCount, 1);
      assert.deepStrictEqual( {
        id: new TokenBalanceVersionId({tokenBalanceId:newTokenBalanceId, versionNumber:0}).value,
        txId: tx1.id,
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
      const tokenBalanceCount =  await prisma.tokenBalance.count();
      const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count();
      const accountCount =  await prisma.account.count();
      const newTokenId = new TokenId(chainId, "token2");
      const newTokenBalanceId = new TokenBalanceId({accountId:reserveId, tokenId:newTokenId,stream: "stream"})
      const { updatedOrNewTokenBalance,newVersion} = await tokenBalanceOperations.addTokenBalanceVersion({tokenBalanceId: newTokenBalanceId, txId:tx1.id });
      assert.strictEqual(await prisma.tokenBalance.count()-tokenBalanceCount, 1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count()-tokenBalanceVersionCount, 1);
      assert.strictEqual(await prisma.account.count() - accountCount, 0);
      assert.deepStrictEqual( {
        id: new TokenBalanceVersionId({tokenBalanceId:newTokenBalanceId, versionNumber:0}).value,
        txId: tx1.id,
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
      const tokenBalanceId = new TokenBalanceId({accountId:kandelId, tokenId:baseId, stream: "stream1"});
      await assert.rejects( tokenBalanceOperations.getTokenBalance( tokenBalanceId) );
    })

    it("Has token balance", async () => {
      const tokenBalanceId = new TokenBalanceId({accountId:reserveId, tokenId:tokenId,  stream: "stream1"});
      const thisTokenBalance = await tokenBalanceOperations.getTokenBalance( tokenBalanceId );
      assert.deepStrictEqual( tokenBalance1, thisTokenBalance )
    })
  })

  describe(TokenBalanceOperations.prototype.getCurrentTokenBalanceVersion.name,  () => {
    it("No current version", async () => {
      await assert.rejects( tokenBalanceOperations.getCurrentTokenBalanceVersion({ ...tokenBalance1, currentVersionId: "noMatch"}) );
    })

    it("Has current version", async () => {
      const thisTokenBalance =  await tokenBalanceOperations.getCurrentTokenBalanceVersion( tokenBalance1);
      assert.deepStrictEqual( tokenBalanceVersion, thisTokenBalance )
    })
  })

  describe(TokenBalanceOperations.prototype.getTokenBalanceId.name, () => {
    it("With id", () => {
      const id =  tokenBalanceOperations.getTokenBalanceId( tokenBalanceId1);
      assert.strictEqual(tokenBalanceId1.value, id)
    })
    it("With TokenBalance", () => {
      const id =  tokenBalanceOperations.getTokenBalanceId( tokenBalance1);
      assert.strictEqual(tokenBalance1.id, id)
    })
  })

  describe(TokenBalanceOperations.prototype.deleteLatestTokenBalanceVersion.name,  () => {
    it("No token balance", async () => {

      await assert.rejects( tokenBalanceOperations.deleteLatestTokenBalanceVersion( new TokenBalanceId({ accountId: new AccountId(chainId, "noMatch"), tokenId:tokenId, stream: "stream"})) );
    })
    it("No prevVersion", async () => {
      const tokenBalanceCount = await prisma.tokenBalance.count();
      const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count();
      await tokenBalanceOperations.deleteLatestTokenBalanceVersion( tokenBalanceId1 );
      assert.strictEqual(await prisma.tokenBalance.count() - tokenBalanceCount, -1);
      assert.strictEqual(await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, -1);
    })

    it("Has prevVersion", async () => {
      await tokenBalanceOperations.addTokenBalanceVersion({ tokenBalanceId: tokenBalanceId1, txId: "txId2", updateFunc: (v) => {v.deposit="10"; v.balance= "30"; } })
      const tokenBalanceCount = await prisma.tokenBalance.count();
      const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count();
      await tokenBalanceOperations.deleteLatestTokenBalanceVersion( tokenBalanceId1 );
      assert.strictEqual(await prisma.tokenBalance.count() - tokenBalanceCount, 0);
      assert.strictEqual(await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, -1);
    })
  })

  describe(TokenBalanceOperations.prototype.createTokenBalanceEvent.name, async () => {
    it( "With kandelId and taken offerId", async () => {
      const tokenBalanceCount = await prisma.tokenBalanceEvent.count();
      const takenOfferId = new TakenOfferId( new OrderId(mangroveId, offerListKey, "proximaId"), 2);
      const event = await tokenBalanceOperations.createTokenBalanceEvent(reserveId, tokenId, tokenBalanceVersion, takenOfferId)
      assert.strictEqual(await prisma.tokenBalanceEvent.count()-tokenBalanceCount, 1);
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

  it(TokenBalanceOperations.prototype.getCurrentBaseAndQuoteBalanceForAddress.name, async () => {
    const balances =  await tokenBalanceOperations.getCurrentBaseAndQuoteBalanceForAddress( reserveId, baseId, quoteId, tx2 );

    assert.deepStrictEqual( balances, { 
      baseSend: "13", 
      baseReceived: "5",
      quoteSend: "5",
      quoteReceived: "8",
     } )
  })

});
