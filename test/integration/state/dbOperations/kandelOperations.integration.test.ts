import { Account, Kandel, KandelConfiguration, KandelVersion, Token, Transaction } from "@prisma/client";
import assert from "assert";
import { before, describe } from "mocha";
import { KandelOperations } from "src/state/dbOperations/kandelOperations";
import {
  AccountId,
  ChainId,
  KandelId,
  KandelVersionId,
  MangroveId,
  OfferId,
  OfferListKey,
  OfferListingId,
  TokenBalanceId,
  TokenBalanceVersionId,
  TokenId
} from "src/state/model";
import { prisma } from "utils/test/mochaHooks";

describe("Kandel Operations Integration test suite", () => {
  let kandelOperations: KandelOperations;

  before(() => {
    kandelOperations = new KandelOperations(prisma);
  });

  const chainId = new ChainId(10);
  const reserveId = new AccountId(chainId, "reserveAddress");
  const baseId = new TokenId(chainId,"baseAddress");
  const quoteId = new TokenId(chainId,"quoteAddress");
  const mangroveId = new MangroveId(chainId, "mangroveAddress");
  const kandelId = new KandelId(chainId, "kandelAddress");
  const kandelVersionId = new KandelVersionId({kandelId, versionNumber:0})
  const offerListKey: OfferListKey = {
    outboundToken: baseId.tokenAddress,
    inboundToken: quoteId.tokenAddress,
  };
  const offerListingId = new OfferListingId(mangroveId, offerListKey);
  const baseTokenBalanceId= new TokenBalanceId({ accountId:reserveId, tokenId: baseId, stream: "stream"})
  const baseTokenBalanceVersionId = new TokenBalanceVersionId({ tokenBalanceId:baseTokenBalanceId, versionNumber: 0 })
  const quoteTokenBalanceId= new TokenBalanceId({ accountId:reserveId, tokenId: quoteId, stream: "stream"})
  const quoteTokenBalanceVersionId = new TokenBalanceVersionId({ tokenBalanceId:quoteTokenBalanceId, versionNumber: 0 })

  let tx:Transaction;
  let baseToken:Token;
  let quoteToken:Token;
  let reserve:Account;
  let kandel:Kandel;
  let kandelVersion:KandelVersion;
  let kandelConfiguration:KandelConfiguration;
  let account:Account;


  beforeEach(async () => {

    tx = await prisma.transaction.create({
      data: {
        id: "txId",
        chainId: chainId.value,
        txHash: "txHash",
        from: "from",
        blockNumber: 0,
        blockHash: "blockHash",
        time: new Date(2023,1,1)
      }
    })

    baseToken = await prisma.token.create({
      data: {
        id: baseId.value,
        chainId: chainId.value,
        address: baseId.tokenAddress,
        symbol: "t",
        name: "token",
        decimals: 0,
      },
    });

    quoteToken = await prisma.token.create({
      data: {
        id: quoteId.value,
        chainId: chainId.value,
        address: quoteId.tokenAddress,
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

    await prisma.tokenBalance.create( {
      data: {
        id: baseTokenBalanceId.value,
        accountId: kandelId.value,
        currentVersionId: baseTokenBalanceVersionId.value,
        tokenId: baseId.value,
        stream: "stream"
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: baseTokenBalanceVersionId.value,
        tokenBalanceId: baseTokenBalanceId.value,
        txId: tx.id,
        send: "0",
        received: "0",
        deposit: "0",
        withdrawal: "0",
        balance: "0",
        versionNumber: 0
      }
    })

    await prisma.tokenBalance.create( {
      data: {
        id: quoteTokenBalanceId.value,
        accountId: kandelId.value,
        currentVersionId: quoteTokenBalanceVersionId.value,
        tokenId: quoteId.value,
        stream: "stream"
      }
    })

    await prisma.tokenBalanceVersion.create({
      data: {
        id: quoteTokenBalanceVersionId.value,
        tokenBalanceId: quoteTokenBalanceId.value,
        txId: tx.id,
        send: "0",
        received: "0",
        deposit: "0",
        withdrawal: "0",
        balance: "0",
        versionNumber: 0
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
        currentVersionId: kandelVersionId.value
      }
    })

    account = await prisma.account.create( {
      data: {
        id: kandelId.value,
        chainId: chainId.value,
        address: kandelId.address
      }
    })

    kandelConfiguration = await prisma.kandelConfiguration.create({
      data: {
        compoundRateBase: 0.,
        compoundRateQuote: 0.,
        ratio: 0.,
        spread: 0.,
        gasReq: "0",
        gasPrice: "0",
        length: 0,
      }
    })

    kandelVersion = await prisma.kandelVersion.create( {
      data: {
        id: kandelVersionId.value,
        kandelId: kandelId.value,
        versionNumber: kandelVersionId.params.versionNumber,
        txId: tx.id,
        congigurationId: kandelConfiguration.id,
        adminId: "adminId",
        routerAddress: "routerAddress"
      }
    })

  });


  describe(KandelOperations.prototype.addVersionedKandel.name, () => {

    it("New version, but no update function", async () => {
      assert.strictEqual(await prisma.kandel.count(), 1);
      assert.strictEqual(await prisma.kandelVersion.count(), 1);
      await assert.rejects( kandelOperations.addVersionedKandel( { id: kandelId, txId: tx.id }) )
    })

    it("New version, with update function", async () => {
      assert.strictEqual(await prisma.kandel.count(), 1);
      assert.strictEqual(await prisma.kandelVersion.count(), 1);
      const {kandelVersion:newVersion} =   await kandelOperations.addVersionedKandel( { id: kandelId, txId: "txId2", updateFunc: (v) => v.routerAddress ="newAddress" })
      assert.deepStrictEqual( newVersion,
        { ...kandelVersion,
        id: new KandelVersionId({kandelId, versionNumber: 1 }).value,
        txId: "txId2",
        versionNumber: 1,
        prevVersionId: kandelVersionId.value,
        routerAddress: "newAddress"
        } )
    })

    it("Brand new version, but no constParams", async () => {
      await assert.rejects( kandelOperations.addVersionedKandel( { id: new KandelId(chainId, "newKandel"), txId: "txId2"}) )
    } )

    it("Brand new Kandel, but no Reserve Id when creating an AaveKandel", async () => {
      await assert.rejects( kandelOperations.addVersionedKandel( { id: new KandelId(chainId, "newKandel"), txId: "txId2", constParams: { mangroveId: mangroveId, base: baseId, quote: quoteId, type: "NewAaveKandel" }}) )
    })

    it("Brand new Kandel, no Reserve Id when creating an normal Kandel", async () => {
      assert.strictEqual(await prisma.kandel.count(), 1);
      assert.strictEqual(await prisma.kandelVersion.count(), 1);
      assert.strictEqual(await prisma.account.count(), 2);
      const newKandelId = new KandelId(chainId, "newKandel");
      const newKandelVersionId = new KandelVersionId({kandelId:newKandelId, versionNumber: 0});
      const {kandelVersion:newVersion} =  await kandelOperations.addVersionedKandel( { id: newKandelId, txId: "txId2", constParams: { mangroveId: mangroveId, base: baseId, quote: quoteId, type: "NewKandel" }});
      assert.strictEqual(await prisma.kandel.count(), 2);
      assert.strictEqual(await prisma.kandelVersion.count(), 2);
      assert.strictEqual(await prisma.account.count(), 3);
      assert.deepStrictEqual( newVersion,
        { 
          id: newKandelVersionId.value,
          kandelId: newKandelId.value,
          txId: "txId2",
          congigurationId: "",
          adminId: "",
          routerAddress: "",
          versionNumber: 0,
          prevVersionId: null
        } )
      const newKandel = await prisma.kandel.findUnique({where: {id: newKandelId.value}});
      assert.deepStrictEqual( newKandel,
        { 
          id: newKandelId.value,
          mangroveId: mangroveId.value,
          baseId: baseId.value,
          quoteId: quoteId.value,
          reserveId: new AccountId(mangroveId.chainId, newKandelId.address).value,
          currentVersionId: newKandelVersionId.value,
          type: "NewKandel"
        } )
      const newAccount = await prisma.account.findUnique( {where: {id: newKandelId.value}})
      assert.deepStrictEqual(newAccount, {
        id: newKandelId.value,
        chainId: chainId.value,
        address: newKandelId.address
      })
    })
    it("Brand new Kandel, has same Reserve Id when creating an AaveKandel", async () => {
      assert.strictEqual(await prisma.kandel.count(), 1);
      assert.strictEqual(await prisma.kandelVersion.count(), 1);
      assert.strictEqual(await prisma.account.count(), 2);
      const newKandelId = new KandelId(chainId, "newKandel");
      const newKandelVersionId = new KandelVersionId({kandelId:newKandelId, versionNumber: 0});
      const {kandelVersion:newVersion} =  await kandelOperations.addVersionedKandel( { id: newKandelId, txId: "txId2", constParams: { reserveId: reserveId, mangroveId: mangroveId, base: baseId, quote: quoteId, type: "NewAaveKandel" }});
      assert.strictEqual(await prisma.kandel.count(), 2);
      assert.strictEqual(await prisma.kandelVersion.count(), 2);
      assert.strictEqual(await prisma.account.count(), 3);
      assert.deepStrictEqual( newVersion,
        { 
          id: newKandelVersionId.value,
          kandelId: newKandelId.value,
          txId: "txId2",
          congigurationId: "",
          adminId: "",
          routerAddress: "",
          versionNumber: 0,
          prevVersionId: null
        } )
      const newKandel = await prisma.kandel.findUnique({where: {id: newKandelId.value}});
      assert.deepStrictEqual( newKandel,
        { 
          id: newKandelId.value,
          mangroveId: mangroveId.value,
          baseId: baseId.value,
          quoteId: quoteId.value,
          reserveId: reserveId.value,
          currentVersionId: newKandelVersionId.value,
          type: "NewAaveKandel"
        } )
      const newAccount = await prisma.account.findUnique( {where: {id: newKandelId.value}})
      assert.deepStrictEqual(newAccount, {
        id: newKandelId.value,
        chainId: chainId.value,
        address: newKandelId.address
      })
    })
    it("Brand new Kandel, has different Reserve Id when creating an AaveKandel", async () => {
      assert.strictEqual(await prisma.kandel.count(), 1);
      assert.strictEqual(await prisma.kandelVersion.count(), 1);
      assert.strictEqual(await prisma.account.count(), 2);
      const newKandelId = new KandelId(chainId, "newKandel");
      const newKandelVersionId = new KandelVersionId({kandelId:newKandelId, versionNumber: 0});
      const newReserveId = new AccountId(chainId, "newReserve")
      const {kandelVersion:newVersion} =   await kandelOperations.addVersionedKandel( { id: newKandelId, txId: "txId2", constParams: { reserveId: newReserveId, mangroveId: mangroveId, base: baseId, quote: quoteId, type: "NewAaveKandel" }});
      assert.strictEqual(await prisma.kandel.count(), 2);
      assert.strictEqual(await prisma.kandelVersion.count(), 2);
      assert.strictEqual(await prisma.account.count(), 4);
      assert.deepStrictEqual( newVersion,
        { 
          id: newKandelVersionId.value,
          kandelId: newKandelId.value,
          txId: "txId2",
          congigurationId: "",
          adminId: "",
          routerAddress: "",
          versionNumber: 0,
          prevVersionId: null
        } )
      const newKandel = await prisma.kandel.findUnique({where: {id: newKandelId.value}});
      assert.deepStrictEqual( newKandel,
        { 
          id: newKandelId.value,
          mangroveId: mangroveId.value,
          baseId: baseId.value,
          quoteId: quoteId.value,
          reserveId: newReserveId.value,
          currentVersionId: newKandelVersionId.value,
          type: "NewAaveKandel"
        } )
      const newAccount = await prisma.account.findUnique( {where: {id: newKandelId.value}})
      assert.deepStrictEqual(newAccount, {
        id: newKandelId.value,
        chainId: chainId.value,
        address: newKandelId.address
      })
      const newReserve = await prisma.account.findUnique( {where: {id: newReserveId.value}})
      assert.deepStrictEqual(newReserve, {
        id: newReserveId.value,
        chainId: chainId.value,
        address: newReserveId.address
      })
    })
  });

  it(KandelOperations.prototype.createNewKandelConfiguration.name, async () => {
    const newConfig = {
      compoundRateBase: 1,
      compoundRateQuote: 1,
      gasPrice: "100",
      gasReq: "60000",
      spread: 10,
      ratio: 2,
      length: 20
    }
    assert.strictEqual( await prisma.kandelConfiguration.count(), 1);
    const savedConfig = await kandelOperations.createNewKandelConfiguration(newConfig);
    assert.strictEqual( await prisma.kandelConfiguration.count(), 2);
    const prismaKandelConfig = await prisma.kandelConfiguration.findUnique({where: {id: savedConfig.id}})
    assert.deepStrictEqual( savedConfig, prismaKandelConfig );
    assert.deepStrictEqual( {...newConfig, id: prismaKandelConfig?.id}, prismaKandelConfig );
  })

  describe(KandelOperations.prototype.getCurrentKandelConfigration.name,  () => {
    it("cannot find config for kandel", async () => {
      const newKandelId = new KandelId(chainId, "newKandel");
      const {kandel: k, kandelVersion: newKandelVersion} = await kandelOperations.addVersionedKandel({ id: newKandelId, txId: "txId2", constParams: { mangroveId, base:baseId, quote:quoteId, type:"NewKandel" }})
      await assert.rejects( kandelOperations.getCurrentKandelConfigration(newKandelId), new Error(`Cannot find kandel config for kandelId: ${newKandelId.value}, currentVersion: ${newKandelVersion.id} and configId: ${newKandelVersion.congigurationId}` ))

    })   
    it("can find config for kandel", async () => {
      const config = await kandelOperations.getCurrentKandelConfigration(kandelId);
      assert.deepStrictEqual( config, kandelConfiguration )
    })
  })
  describe(KandelOperations.prototype.getCurrentKandelVersion.name,  () => {
    it("cant find kandel", async () => {
      await assert.rejects( kandelOperations.getCurrentKandelVersion( new KandelId(chainId, "noMatch") ) );
    })

    it("cant find kandel", async () => {
      await prisma.kandel.update({where: {id: kandelId.value }, data: { currentVersionId: "" }})
      await prisma.kandelVersion.delete({where: {id: kandelVersionId.value}});
      await assert.rejects( kandelOperations.getCurrentKandelVersion( kandelId ) );
    })

    it("finds kandel version", async () => {
      const foundVersion = await kandelOperations.getCurrentKandelVersion( kandelId ) ;
      assert.deepStrictEqual( kandelVersion, foundVersion );
    })

  })
  describe(KandelOperations.prototype.getId.name,  () => {
    it("with KandelId", async () => {
      const id = kandelOperations.getId( kandelId);
      assert.strictEqual( kandelId.value, id );
    })
    it("with Kandel", async () => {
      const id = kandelOperations.getId( kandel);
      assert.strictEqual( kandel.id, id );
    })
  })
  describe(KandelOperations.prototype.deleteLatestKandelVersion.name,  () => {
    it("cant find kandel", async () => {
      await assert.rejects( kandelOperations.deleteLatestKandelVersion(new KandelId(chainId, "noMatch")) )
    })
    it("no prevVersion", async () => {
      assert.strictEqual( await prisma.kandel.count(), 1 );
      assert.strictEqual( await prisma.kandelVersion.count(), 1 );
      assert.strictEqual( await prisma.kandelConfiguration.count(), 1 );
      await kandelOperations.deleteLatestKandelVersion( kandelId );
      assert.strictEqual( await prisma.kandel.count(), 0 );
      assert.strictEqual( await prisma.kandelVersion.count(), 0 );
      assert.strictEqual( await prisma.kandelConfiguration.count(), 0 );

    })
    it("has prevVersion", async () => {
      await kandelOperations.addVersionedKandel({id: kandelId, txId: "txId2", updateFunc: (v) => v.adminId="newAdmin"});
      assert.strictEqual( await prisma.kandel.count(), 1 );
      assert.strictEqual( await prisma.kandelVersion.count(), 2 );
      assert.strictEqual( await prisma.kandelConfiguration.count(), 1 );
      await kandelOperations.deleteLatestKandelVersion( kandelId );
      assert.strictEqual( await prisma.kandel.count(), 1 );
      assert.strictEqual( await prisma.kandelVersion.count(), 1 );
      assert.strictEqual( await prisma.kandelConfiguration.count(), 1 );
    })
  })
  describe(KandelOperations.prototype.deleteKandelConfigIfNotUsed.name,  () => {
    it("not used", async () => {
      await prisma.kandel.update({where: {id: kandelId.value }, data: { currentVersionId: "" }})
      await prisma.kandelVersion.delete({where: {id: kandelVersionId.value}});
      assert.strictEqual( await prisma.kandelConfiguration.count(), 1 );
      const deleted = await kandelOperations.deleteKandelConfigIfNotUsed(kandelConfiguration.id);
      assert.strictEqual(deleted, true);
      assert.strictEqual( await prisma.kandelConfiguration.count(), 0 );
    })
    it("used", async () => {
      const deleted = await kandelOperations.deleteKandelConfigIfNotUsed(kandelConfiguration.id);
      assert.strictEqual(deleted, false);
      assert.strictEqual( await prisma.kandelConfiguration.count(), 1 );
    })
  })
  describe(KandelOperations.prototype.getReserveAddress.name,  () => {
    it("cannot find reserve + using kandel Id", async () => {
      await assert.rejects( kandelOperations.getReserveAddress({ kandel:{...kandel, reserveId: "noMatch"} }))
    })
    it("can find reserve + using prisma kandel", async () => {
      const reserveAddress =  await kandelOperations.getReserveAddress({kandel});
      assert.strictEqual( reserveAddress, reserve.address )
    })
  })
  describe(KandelOperations.prototype.getToken.name,  () => {
    it("cannot find base", async () => {
      const newKandelId = new KandelId(chainId, "newKandel")
      await kandelOperations.addVersionedKandel({ id: newKandelId, txId: "txId2", constParams:{ base: new TokenId(chainId, "noMatch"), quote: quoteId, mangroveId, type:"NewKandel"} })
      await assert.rejects( kandelOperations.getToken(newKandelId, "baseId") )
    })
    it("can find base", async () => {
      const token = await kandelOperations.getToken(kandelId, "baseId");
      assert.deepStrictEqual(baseToken, token);
    })
    it("cannot find quote", async () => {
      const newKandelId = new KandelId(chainId, "newKandel")
      await kandelOperations.addVersionedKandel({ id: newKandelId, txId: "txId2", constParams:{ base: baseId, quote: new TokenId(chainId, "noMatch"), mangroveId, type:"NewKandel"} })
      await assert.rejects( kandelOperations.getToken(newKandelId, "quoteId") )
    })
    it("can find quote", async () => {
      const token = await kandelOperations.getToken(kandelId, "quoteId");
      assert.deepStrictEqual(quoteToken, token);
    })
  })
  describe(KandelOperations.prototype.getKandel.name,  () => {
    it("cannot find kandel", async () => {
      await assert.rejects( kandelOperations.getKandel(new KandelId(chainId, "noMatch")) );
    })
    it("can find kandel", async () => {
      const foundKandel = await kandelOperations.getKandel( kandelId);
      assert.deepStrictEqual(foundKandel, kandel)
    })
  })
  it(KandelOperations.prototype.createOfferIndex.name, async () => {
    const offerId = new OfferId(mangroveId, offerListKey, 1);
    assert.strictEqual( await prisma.kandelOfferIndex.count(), 0);
    const offerIndex = await kandelOperations.createOfferIndex(kandelId, tx.id, offerId, 1, "ask");
    assert.strictEqual( await prisma.kandelOfferIndex.count(), 1);
    assert.deepStrictEqual( offerIndex, { 
      kandelId: kandelId.value,
      txId: tx.id,
      offerId: offerId.value,
      index: 1,
      ba: "ask"
    } )
  })
  it(KandelOperations.prototype.deleteOfferIndex.name, async () => {
    const offerId = new OfferId(mangroveId, offerListKey, 1);
    const offerIndex = await kandelOperations.createOfferIndex(kandelId, tx.id, offerId, 1, "ask");
    assert.strictEqual( await prisma.kandelOfferIndex.count(), 1);
    await kandelOperations.deleteOfferIndex(kandelId, offerId, "ask");
    assert.strictEqual( await prisma.kandelOfferIndex.count(), 0);
  })
  describe(KandelOperations.prototype.getKandelFromOffer.name,  () => {
    it("cannot find maker", async () => {
      const offerId = new OfferId(mangroveId, offerListKey, 1);
      const offer = await prisma.offer.create({data: {
        id: offerId.value,
        mangroveId: mangroveId.value,
        offerListingId: offerListingId.value,
        makerId: "noMatch",
        offerNumber: 0,
        currentVersionId: ""
      }})
      await assert.rejects(  kandelOperations.getKandelFromOffer(offer) );
    })
    it("can find maker, but not kandel maker", async () => {
      const offerId = new OfferId(mangroveId, offerListKey, 1);
      const offer = await prisma.offer.create({data: {
        id: offerId.value,
        mangroveId: mangroveId.value,
        offerListingId: offerListingId.value,
        makerId: reserveId.value,
        offerNumber: 0,
        currentVersionId: ""
      }})
      const foundKandel = await kandelOperations.getKandelFromOffer(offer);
      assert.strictEqual(foundKandel, null)
    })
    it("can find maker and is kandel maker", async () => {
      const offerId = new OfferId(mangroveId, offerListKey, 1);
      const offer = await prisma.offer.create({data: {
        id: offerId.value,
        mangroveId: mangroveId.value,
        offerListingId: offerListingId.value,
        makerId: kandelId.value,
        offerNumber: 0,
        currentVersionId: ""
      }})
       const foundKandel = await kandelOperations.getKandelFromOffer(offer);
       assert.deepStrictEqual( foundKandel, kandel );
    })
  })
  describe(KandelOperations.prototype.createKandelEvent.name,  () => {
    it("with Kandel Id + kandel version Id", async () => {
      assert.strictEqual( await prisma.kandelEvent.count(), 0);
      const event = await kandelOperations.createKandelEvent(kandelId,"txId", kandelVersionId);
      assert.strictEqual( await prisma.kandelEvent.count(), 1);
      assert.deepStrictEqual( event, {
        id: event.id,
        kandelId: kandelId.value,
        kandelVersionId: kandelVersionId.value,
        txId: "txId"
      })
    })
    it("With Prisma kandel + prisma kandel version", async () => {
      assert.strictEqual( await prisma.kandelEvent.count(), 0);
      const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
      assert.strictEqual( await prisma.kandelEvent.count(), 1);
      assert.deepStrictEqual( event, {
        id: event.id,
        kandelId: kandel.id,
        kandelVersionId: kandelVersion.id,
        txId: "txId"
      })
    })
  })
  it(KandelOperations.prototype.createNewKandelEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.newKandelEvent.count(), 0);
    const newKandelEvent = await kandelOperations.createNewKandelEvent(event);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.newKandelEvent.count(), 1);
    assert.strictEqual(newKandelEvent.eventId, event.id);
    
  })
  it(KandelOperations.prototype.createKandelAdminEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelAdminEvent.count(), 0);
    const adminEvent = await kandelOperations.createKandelAdminEvent(event, "admin");
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelAdminEvent.count(), 1);
    assert.strictEqual(adminEvent.eventId, event.id);
    assert.strictEqual(adminEvent.admin, "admin");
  })
  it(KandelOperations.prototype.createKandelRouterEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelRouterEvent.count(), 0);
    const routerEvent = await kandelOperations.createKandelRouterEvent(event, "router");
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelRouterEvent.count(), 1);
    assert.strictEqual(routerEvent.eventId, event.id);
    assert.strictEqual(routerEvent.router, "router");
  })
  it(KandelOperations.prototype.createKandelGasReqEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelGasReqEvent.count(), 0);
    const gasreqEvent = await kandelOperations.createKandelGasReqEvent(event, "100");
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelGasReqEvent.count(), 1);
    assert.strictEqual(gasreqEvent.eventId, event.id);
    assert.strictEqual(gasreqEvent.gasReq, "100");
  })
  it(KandelOperations.prototype.createKandelGasPriceEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelGasPriceEvent.count(), 0);
    const gaspriceEvent = await kandelOperations.createKandelGasPriceEvent(event, "100");
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelGasPriceEvent.count(), 1);
    assert.strictEqual(gaspriceEvent.eventId, event.id);
    assert.strictEqual(gaspriceEvent.gasPrice, "100");
  })
  it(KandelOperations.prototype.createKandelLengthEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelLengthEvent.count(), 0);
    const lengthEvent = await kandelOperations.createKandelLengthEvent(event, 100);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelLengthEvent.count(), 1);
    assert.strictEqual(lengthEvent.eventId, event.id);
    assert.strictEqual(lengthEvent.length, 100);
  })
  it(KandelOperations.prototype.createKandelGeometricParamsEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelGeometricParamsEvent.count(), 0);
    const kandelGeometricParamsEvent = await kandelOperations.createKandelGeometricParamsEvent(event, 100, 10);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelGeometricParamsEvent.count(), 1);
    assert.strictEqual(kandelGeometricParamsEvent.eventId, event.id);
    assert.strictEqual(kandelGeometricParamsEvent.ratio, 100);
    assert.strictEqual(kandelGeometricParamsEvent.spread, 10);
  })

  it(KandelOperations.prototype.createKandelCompoundRateEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelCompoundRateEvent.count(), 0);
    const kandelCompoundRateEvent = await kandelOperations.createKandelCompoundRateEvent(event, 100, 10);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelCompoundRateEvent.count(), 1);
    assert.strictEqual(kandelCompoundRateEvent.eventId, event.id);
    assert.strictEqual(kandelCompoundRateEvent.compoundRateBase, 100);
    assert.strictEqual(kandelCompoundRateEvent.compoundRateQuote, 10);
  })

  it(KandelOperations.prototype.createKandelPopulateEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelPopulateEvent.count(), 0);
    const kandelPopulateEvent = await kandelOperations.createKandelPopulateEvent(event, tx);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelPopulateEvent.count(), 1);
    assert.deepStrictEqual(kandelPopulateEvent, {
      id: kandelPopulateEvent.id,
      eventId: event.id,
      baseTokenId: baseId.value,
      quoteTokenId: quoteId.value,
      baseSend: "0",
      quoteSend: "0",
      baseReceived: "0",
      quoteReceived: "0",
    });
  })

  it(KandelOperations.prototype.createKandelRetractEvent.name, async () => {
    const event = await kandelOperations.createKandelEvent(kandel, "txId", kandelVersion);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelRetractEvent.count(), 0);
    const kandelRetractEvent = await kandelOperations.createKandelRetractEvent(event, tx);
    assert.strictEqual( await prisma.kandelEvent.count(), 1);
    assert.strictEqual( await prisma.kandelRetractEvent.count(), 1);
    assert.deepStrictEqual(kandelRetractEvent, {
      id: kandelRetractEvent.id,
      eventId: event.id,
      baseTokenId: baseId.value,
      quoteTokenId: quoteId.value,
      baseSend: "0",
      quoteSend: "0",
      baseReceived: "0",
      quoteReceived: "0",
    });
  })


});
