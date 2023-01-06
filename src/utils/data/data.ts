import { TakenOffer } from "@proximaone/stream-schema-mangrove/dist/core";
import { MangroveEvent } from "@proximaone/stream-schema-mangrove/dist/events";
import { StrategyEvent } from "@proximaone/stream-schema-mangrove/dist/strategyEvents";
import { NewToken } from "src/state/handlers/tokensHandler/tokenEventHandler";
import { Offset, StreamEvent, Timestamp } from "@proximaone/stream-client-js";

const chainName = "polygon-main";
export const chainId = 137;


function toStreamEvent(json:string):StreamEvent{
    return new StreamEvent(Offset.zero, Buffer.from(json), Timestamp.fromEpochMs(1671490800000), false);
}



export function getTokenEvents(): StreamEvent[] {
    const inboundEvent: NewToken= {
        address: "inboundAddress",
        symbol: "i",
        name: "inbound",
        totalSupply: "10000",
        decimals: 6
    }
    const outboundEvent: NewToken = {

        address: "outboundAddress",
        symbol: "o",
        name: "outbound",
        totalSupply: "10000",
        decimals: 18
    }
    return [toStreamEvent( JSON.stringify( inboundEvent ) ), toStreamEvent( JSON.stringify( outboundEvent))] ;
}

export function getMangroveCreatedEvent(): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "MangroveCreated",
        id: "mangroveCreatedId",
        address: "mangroveAddress",
        chain: {
            name: "polygon",
            chainlistId: 10
        }
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getMangroveParamsUpdatedEvent(): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "MangroveParamsUpdated",
        params: {
            governance: "governance",
            monitor: "monitor",
            vault: "vault",
            useOracle: true,
            notify: true,
            gasmax: 10,
            gasprice: 20,
            dead: false
        }
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getOfferListParamsUpdated(): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "OfferListParamsUpdated",
        offerList: {
            inboundToken: "inboundAddress",
            outboundToken: "outboundAddress"
        },
        params: {
            active: true,
            fee: "100",
            gasbase: 10,
            density: "20"
        }
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getMakerBalanceUpdated(): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "MakerBalanceUpdated",
        maker: "makerAddress",
        amountChange: "10000"
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getTakerApprovalUpdated(): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "TakerApprovalUpdated",
        owner: "ownerAddress",
        offerList: {
            inboundToken: "inboundAddress",
            outboundToken: "outboundAddress"
        },
        spender: "spenderAddress",
        amount: "10000"
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getOfferWrittenEvent(offerNumber: number, wants: string, gives: string): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "OfferWritten",
        offerList: {
            inboundToken: "inboundAddress",
            outboundToken: "outboundAddress"
        },
        offer: {
            id: offerNumber,
            prev: 0,
            wants: wants,
            gives: gives,
            gasprice: 10,
            gasreq: 1000
        },
        maker: "makerAddress"
    };
    return toStreamEvent( JSON.stringify( event ) );
}


export function getOrderCompletedEvent(): StreamEvent {
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "OrderCompleted",
        offerList: {
            inboundToken: "inboundAddress",
            outboundToken: "outboundAddress"
        },
        id: "orderId", // should match OrderSummary
        order: {
            taker: "takerAddress",
            takerGot: "1000",
            takerGave: "500",
            // takerWants: "2000",
            // takerGives: "1000",
            penalty: "0",
            feePaid: "0",
            takenOffers:  Array.from(Array(10).keys()).flatMap((value) => getTakenOffer(value))
        }
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getTakenOffer(offerNumber: number):TakenOffer{
    return {
        id: offerNumber,
        takerWants: "100",
        takerGives: "50",
    };
}

export function getOrderSummaryEvent(): StreamEvent {
    const event: StrategyEvent = {
        tx: {
            chain: chainName,
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        id: "MangroveOrderId",
        chainId: chainId,
        address: "MangroveOrderAddress",
        type: "OrderSummary",
        mangroveId: "mangroveId",
        outboundToken: "outboundAddress",
        inboundToken: "inboundAddress",
        orderId: "orderId", // should match the created order
        fillWants: true,
        fillOrKill: false,
        restingOrder: true,
        taker: "takerAddress",
        takerWants: "2000",
        takerGives: "1000",
        takerGot: "1000",
        takerGave: "500",
        bounty: "0",
        fee: "10",
        expiryDate: 1672354800, // Fri Dec 30 2022 00:00:00
        restingOrderId: 11
    };
    return toStreamEvent( JSON.stringify( event ) );
}

export function getSetExpiryEvent(expiryDate: number){
    const event:StrategyEvent= {
        tx: {
            chain: chainName,
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        id: "MangroveOrderId",
        chainId: chainId,
        address: "MangroveOrderAddress",
        type: "SetExpiry",
        outboundToken: "outboundAddress",
        inboundToken: "inboundAddress",
        offerId: 11,
        date: expiryDate
    }
    return toStreamEvent( JSON.stringify( event ) );;
}

export function getOfferRetracted():StreamEvent{
    const event: MangroveEvent = {
        tx: {
            blockHash: "hash",
            blockNumber: 1,
            sender: "sender",
            txHash: "txHash"
        },
        mangroveId: "mangroveId",
        chainId: chainId,
        type: "OfferRetracted",
        offerList: {
            inboundToken: "inboundAddress",
            outboundToken: "outboundAddress"
        },
        offerId:11
        };
    
    return toStreamEvent( JSON.stringify( event ) );;
}

