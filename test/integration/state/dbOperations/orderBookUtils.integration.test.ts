import * as prismaModel from "@prisma/client";
import { Timestamp } from "@proximaone/stream-client-js";
import assert from "assert";
import { before, describe } from "mocha";
import { OfferOperations } from "src/state/dbOperations/offerOperations";
import { OrderBookUtils } from "src/state/dbOperations/orderBookUtils";
import { TransactionOperations } from "src/state/dbOperations/transactionOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListingId,
  OfferListKey,
  OfferListingVersionId,
  TokenId,
  TransactionId
} from "src/state/model";
import { prisma } from "utils/test/mochaHooks";

describe("OfferList Operations Integration test suite", () => {
  let offerOperations:OfferOperations;
  let transactionOperations:TransactionOperations;
  let orderBookUtils:OrderBookUtils;
  before(() => {
    offerOperations = new OfferOperations(prisma);
    transactionOperations = new TransactionOperations(prisma);
    orderBookUtils = new OrderBookUtils(prisma);
  });

  const chainId = new ChainId(10);
  const mangroveId = new MangroveId(chainId, "mangroveId");
  const outboundTokenId = new TokenId(chainId, "outboundToken");
  const inboundTokenId = new TokenId(chainId, "inboundToken");
  const offerListKey: OfferListKey = {
    outboundToken: outboundTokenId.tokenAddress,
    inboundToken: inboundTokenId.tokenAddress,
  };
  const makerId = new AccountId(chainId, "makerID");
  const offerListingId = new OfferListingId(mangroveId, offerListKey);
  const offerListingVersionId = new OfferListingVersionId(offerListingId, 0);
  const offerId1 = new OfferId(mangroveId, offerListKey, 1);
  const offerId2 = new OfferId(mangroveId, offerListKey, 2);
  const offerId3 = new OfferId(mangroveId, offerListKey, 3);
  const offerId4 = new OfferId(mangroveId, offerListKey, 4);
  const offerId5 = new OfferId(mangroveId, offerListKey, 5);
  const txId1 = new TransactionId(chainId, "txHash1")
  const txId2 = new TransactionId(chainId, "txHash2")
  const txId3 = new TransactionId(chainId, "txHash3")
  
  let offerListing: prismaModel.OfferListing;
  let offerListingVersion: prismaModel.OfferListingVersion;
  let outboundToken: prismaModel.Token;
  let inboundToken: prismaModel.Token;

  beforeEach(async () => {
    inboundToken = await prisma.token.create({
      data: {
        id: inboundTokenId.value,
        name: "inbound",
        address: "inbound",
        symbol: "i",
        decimals: 0,
        chainId: chainId.value,
      },
    });
    outboundToken = await prisma.token.create({
      data: {
        id: outboundTokenId.value,
        name: "outbound",
        address: "outbound",
        symbol: "o",
        decimals: 0,
        chainId: chainId.value,
      },
    });
    offerListing = await prisma.offerListing.create({
      data: {
        id: offerListingId.value,
        mangroveId: mangroveId.value,
        inboundTokenId: inboundTokenId.value,
        outboundTokenId: outboundTokenId.value,
        currentVersionId: offerListingVersionId.value,
      },
    });
    offerListingVersion = await prisma.offerListingVersion.create({
      data: {
        id: offerListingVersionId.value,
        offerListingId: offerListingId.value,
        txId: txId1.value,
        active: true,
        fee: "100",
        gasbase: 10,
        density: "10",
        versionNumber: offerListingVersionId.versionNumber,
      },
    });
    
    await transactionOperations.ensureTransaction({id:txId1, txHash:txId1.txHash, from:"from", timestamp: Timestamp.fromEpochMs(1672441200000), blockNumber: 1, blockHash: "bHash"}) // Sat Dec 31 2022 00:00:00
    await transactionOperations.ensureTransaction({id:txId2, txHash:txId2.txHash, from:"from", timestamp: Timestamp.fromEpochMs(1672484400000), blockNumber: 1, blockHash: "bHash"}) // Sat Dec 31 2022 12:00:00
    await transactionOperations.ensureTransaction({id:txId3, txHash:txId3.txHash, from:"from", timestamp: Timestamp.fromEpochMs(1672527600000), blockNumber: 1, blockHash: "bHash"}) // Sun Jan 01 2023 00:00:00
    await offerOperations.addVersionedOffer(offerId1, txId1.value, (o) => o.wants="10", {makerId:makerId});
    await offerOperations.addVersionedOffer(offerId1, txId2.value, (o) => o.wants="20", {makerId:makerId});
    await offerOperations.addVersionedOffer(offerId1, txId3.value, (o) => o.wants="25", {makerId:makerId});
    await offerOperations.addVersionedOffer(offerId2, txId1.value, (o) => o.wants="30", {makerId:makerId});
    await offerOperations.addVersionedOffer(offerId3, "noMatch", (o) => o.wants="40", {makerId:makerId});
    await offerOperations.addVersionedOffer(offerId4, txId1.value, (o) => o.wants="50", {makerId:makerId}); 
    await offerOperations.addVersionedOffer(offerId4, txId1.value, (o) => o.wants="50", {makerId:makerId}); 
    await prisma.offerVersion.deleteMany({where:{ offerId: offerId4.value, versionNumber:0}}) // deletes offer 4's previous version
    await prisma.offerVersion.deleteMany({where:{ offerId: offerId2.value, versionNumber:0}}) // deletes offer 2's current version

    await offerOperations.addVersionedOffer(offerId5, txId2.value, (o) => o.wants="50", {makerId:makerId}); 
    })


  it("orderBook", async () => {
    //This sould only return version 0 of offer1
    let orderBook = await orderBookUtils.getMatchingOfferFromOfferListId(offerListingId,1672462800000 ) // Sat Dec 31 2022 06:00:00
    assert.strictEqual(orderBook.length, 1);
    assert.strictEqual(orderBook[0].offerId, offerId1.value)
    assert.strictEqual(orderBook[0].versionNumber, 0)

    //This sould only return version 1 of offer1 and version 0 of offer5
    orderBook = await orderBookUtils.getMatchingOfferFromOfferListId(offerListingId,1672506000000 ) // Sat Dec 31 2022 18:00:00
    assert.strictEqual(orderBook.length, 2);
    assert.strictEqual(orderBook[0].offerId, offerId1.value)
    assert.strictEqual(orderBook[0].versionNumber, 1)
    assert.strictEqual(orderBook[1].offerId, offerId5.value)
    assert.strictEqual(orderBook[1].versionNumber, 0)

    //This sould only return version 2 of offer1 and version 0 of offer5
    orderBook = await orderBookUtils.getMatchingOfferFromOfferListId(offerListingId,1672614000000 ) // Mon Jan 02 2023 00:00:00
    assert.strictEqual(orderBook.length, 2);
    assert.strictEqual(orderBook[0].offerId, offerId1.value)
    assert.strictEqual(orderBook[0].versionNumber, 2)
    assert.strictEqual(orderBook[1].offerId, offerId5.value)
    assert.strictEqual(orderBook[1].versionNumber, 0)
  });

});
