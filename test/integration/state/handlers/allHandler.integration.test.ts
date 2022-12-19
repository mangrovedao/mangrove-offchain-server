import assert from "assert";
import { describe, it } from "mocha";
import { MangroveEventHandler } from "../../../../src/state/handlers/mangroveHandler/handler";
import { TokenEventHandler } from "../../../../src/state/handlers/tokensHandler/handler";
import { IOrderLogicEventHandler } from "../../../../src/state/handlers/stratsHandler/handler";

import { prisma } from "../../../../src/utils/test/mochaHooks";
import * as data from "./data/data";
import { Timestamp } from "@proximaone/stream-client-js";


describe( "All Handlers Integration Test Suite" ,() => {
    it("Handle Mangrove setup and offers", async () => {
        const tokensHandler = new TokenEventHandler(prisma, "testStream");
        await tokensHandler.handleTransitions( data.getTokenEvents() ); 
        assert.strictEqual( await prisma.token.count(), 2 ); // create tokens
        
        const mangroveHandler = new MangroveEventHandler(prisma, "testStream");

        await mangroveHandler.handleTransitions([data.getMangroveCreatedEvent() ]); // create mangrove
        await mangroveHandler.handleTransitions([data.getMangroveParamsUpdatedEvent()] ); // set params on mangrove
        await mangroveHandler.handleTransitions([data.getOfferListParamsUpdated()] ); // open market
        await mangroveHandler.handleTransitions([data.getMakerBalanceUpdated()] ); // add balance to maker
        await mangroveHandler.handleTransitions([data.getTakerApprovalUpdated()] ); // add approval to taker
        await mangroveHandler.handleTransitions( Array.from(Array(10).keys()).flatMap((value) => data.getOfferWrittenEvent(value, "100", "50")) ); // add 10 offers

        
        // MangroveOrder related events
        await mangroveHandler.handleTransitions([data.getOrderCompletedEvent()] ); // create order, that took all 10 offers
        await mangroveHandler.handleTransitions([data.getOfferWrittenEvent(11, "1000", "500")] ); // create offer with residual
        const stratHandler = new IOrderLogicEventHandler(prisma, "testStream"); 
        await stratHandler.handleTransitions([ data.getOrderSummaryEvent() ]); // create orderSummary from orderCompleted and offerWritten
        await stratHandler.handleTransitions([ data.getSetExpiryEvent(Timestamp.fromEpochMs(1672527600000) )]); // date: Sun Jan 01 2023 00:00:00 - update expiry date on resting order

        await mangroveHandler.handleTransitions([data.getOfferRetracted()] ); // cancel resting order

        
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

