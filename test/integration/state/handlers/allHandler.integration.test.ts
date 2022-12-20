import assert from "assert";
import { describe, it } from "mocha";
import { MangroveEventHandler } from "../../../../src/state/handlers/mangroveHandler/handler";
import { TokenEventHandler } from "../../../../src/state/handlers/tokensHandler/handler";
import { IOrderLogicEventHandler } from "../../../../src/state/handlers/stratsHandler/handler";

import { prisma } from "../../../../src/utils/test/mochaHooks";
import * as data from "./data/data";
import { Timestamp } from "@proximaone/stream-client-js";
import { ChainId } from "../../../../src/state/model";


describe( "All Handlers Integration Test Suite" ,() => {
    it("Handle Mangrove setup and offers", async () => {
        const chainId =new ChainId(123);
        const tokensHandler = new TokenEventHandler(prisma, "testStream", chainId);
        await tokensHandler.handleEvents(  data.getTokenEvents() ); 
        assert.strictEqual( await prisma.token.count(), 2 ); // create tokens
        
        const mangroveHandler = new MangroveEventHandler(prisma, "testStream", chainId);

        await mangroveHandler.handleEvents([data.getMangroveCreatedEvent() ]); // create mangrove
        await mangroveHandler.handleEvents([data.getMangroveParamsUpdatedEvent()] ); // set params on mangrove
        await mangroveHandler.handleEvents([data.getOfferListParamsUpdated()] ); // open market
        await mangroveHandler.handleEvents([data.getMakerBalanceUpdated()] ); // add balance to maker
        await mangroveHandler.handleEvents([data.getTakerApprovalUpdated()] ); // add approval to taker
        await mangroveHandler.handleEvents( Array.from(Array(10).keys()).flatMap((value) => data.getOfferWrittenEvent(value, "100", "50")) ); // add 10 offers

        
        // MangroveOrder related events
        await mangroveHandler.handleEvents([data.getOrderCompletedEvent()] ); // create order, that took all 10 offers
        await mangroveHandler.handleEvents([data.getOfferWrittenEvent(11, "1000", "500")] ); // create offer with residual
        const stratHandler = new IOrderLogicEventHandler(prisma, "testStream", chainId); 
        await stratHandler.handleEvents([ data.getOrderSummaryEvent() ]); // create orderSummary from orderCompleted and offerWritten
        // await stratHandler.handleEvents([ data.getSetExpiryEvent(Timestamp.fromEpochMs(1672527600000) )]); // date: Sun Jan 01 2023 00:00:00 - update expiry date on resting order

        await mangroveHandler.handleEvents([data.getOfferRetracted()] ); // cancel resting order

        
        assert.strictEqual(await prisma.mangrove.count() , 1);
        assert.strictEqual(await prisma.mangroveVersion.count() , 2);
        assert.strictEqual( await prisma.offerList.count(), 1)
        assert.strictEqual( await prisma.offerListVersion.count(), 1)
        assert.strictEqual( await prisma.makerBalance.count(), 1)
        assert.strictEqual( await prisma.makerBalanceVersion.count(), 1)
        assert.strictEqual( await prisma.takerApproval.count(), 1)
        assert.strictEqual( await prisma.takerApprovalVersion.count(), 1)
        assert.strictEqual( await prisma.offer.count(), 11)
        assert.strictEqual( await prisma.offerVersion.count(), 22)
    })
})

