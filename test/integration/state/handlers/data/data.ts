import { Event, State, Timestamp, Transition } from "@proximaone/stream-client-js";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { NewFungibleTokenStreamEvent } from "@proximaone/stream-schema-fungible-token/dist/streams";
import { MangroveEvent } from "@proximaone/stream-schema-mangrove/dist/events";
import * as ft from "@proximaone/stream-schema-fungible-token";
import { TakenOffer } from "@proximaone/stream-schema-mangrove/dist/core";
import { SetExpiry, TakerStrategyEvent } from "@proximaone/stream-schema-mangrove/dist/strategyEvents";

const chainName = "polygon-main";
const chainId = 137;



function toMangroveTransition(event: MangroveEvent): Transition {
    const state = new State(event.type);
    const serializedEvent = mangroveSchema.streams.mangrove.serdes.serialize(event);

    const proximaEvent = new Event(serializedEvent, Timestamp.fromEpochMs(1671437095721), false);  // 1671437095721 =>  Mon Dec 19 2022 08:04:55

    return new Transition(state, proximaEvent);
}

function toStratsTransition(event: TakerStrategyEvent): Transition {
    const state = new State(event.type);
    const serializedEvent = mangroveSchema.streams.takerStrategies.serdes.serialize(event);

    const proximaEvent = new Event(serializedEvent, Timestamp.fromEpochMs(1671437095721), false);  // 1671437095721 =>  Mon Dec 19 2022 08:04:55

    return new Transition(state, proximaEvent);
}

function toTokenTransition(event: NewFungibleTokenStreamEvent): Transition {
    const state = new State(event.type);
    const serializedEvent = ft.streams.newFungibleToken.serdes.serialize(event);

    const proximaEvent = new Event(serializedEvent, Timestamp.fromEpochMs(1671437095721), false);  // 1671437095721 =>  Mon Dec 19 2022 08:04:55

    return new Transition(state, proximaEvent);
}



export function getTokenEvents(): Transition[] {
    const inboundEvent: NewFungibleTokenStreamEvent = {
        ref: {
            blockHash: "hash",
            blockNumber: "10",
            txHash: "txHash"
        },
        type: "new",
        id: "inboundTokenId",
        chain: chainName,
        contractAddress: "inboundAddress",
        symbol: "i",
        name: "inbound",
        totalSupply: "10000",
        decimals: 6
    }
    const outboundEvent: NewFungibleTokenStreamEvent = {
        ref: {
            blockHash: "hash",
            blockNumber: "10",
            txHash: "txHash"
        },
        type: "new",
        id: "outboundTokenId",
        chain: chainName,
        contractAddress: "outboundAddress",
        symbol: "o",
        name: "outbound",
        totalSupply: "10000",
        decimals: 18
    }
    return [toTokenTransition(inboundEvent), toTokenTransition(outboundEvent)];
}

export function getMangroveCreatedEvent(): Transition {
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
    return toMangroveTransition(event)
}

export function getMangroveParamsUpdatedEvent(): Transition {
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
    return toMangroveTransition(event)
}

export function getOfferListParamsUpdated(): Transition {
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
    return toMangroveTransition(event)
}

export function getMakerBalanceUpdated(): Transition {
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
    return toMangroveTransition(event)
}

export function getTakerApprovalUpdated(): Transition {
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
    return toMangroveTransition(event)
}

export function getOfferWrittenEvent(offerNumber: number, wants: string, gives: string): Transition {
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
    return toMangroveTransition(event)
}


export function getOrderCompletedEvent(): Transition {
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
            takerWants: "2000",
            takerGives: "1000",
            feePaid: "10",
            bounty: "0",
            takenOffers:  Array.from(Array(10).keys()).flatMap((value) => getTakenOffer(value))
        }
    };
    return toMangroveTransition(event)
}

export function getTakenOffer(offerNumber: number):TakenOffer{
    return {
        id: offerNumber,
        takerGot: "100",
        takerGave: "50",
    };
}

export function getOrderSummaryEvent(): Transition {
    const event: TakerStrategyEvent = {
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
        base: "outboundAddress",
        quote: "inboundAddress",
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
        expiryDate: Timestamp.fromEpochMs(1672354800000).date, // Fri Dec 30 2022 00:00:00
        restingOrderId: 11
    };
    return toStratsTransition(event)
}

export function getSetExpiryEvent(expiryDate: Timestamp){
    const event:TakerStrategyEvent= {
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
        mangroveId: "mangroveId",
        outboundToken: "outboundAddress",
        inboundToken: "inboundAddress",
        offerId: 11,
        expiry: expiryDate.date
    }
    return toStratsTransition(event);
}

export function getOfferRetracted(){
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
    
    return toMangroveTransition(event)
}

