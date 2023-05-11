import { ObjectType, Field } from "type-graphql";
import { Token } from "@generated/type-graphql";

@ObjectType()
export class MangroveOrderFillWithTokens {
    constructor(params: {
        totalFee: number,
        mangroveOrderId?: string,
        taker: string,
        inboundToken: Token,
        outboundToken: Token,
        price: number,
        type: string,
        fillsId: string,
        time: Date,
        amount: number,
        totalPaid: number,
        txHash: string
    }) {
        this.totalFee = params.totalFee;
        this.mangroveOrderId = params.mangroveOrderId;
        this.taker = params.taker;
        this.inbound = params.inboundToken;
        this.outbound = params.outboundToken;
        this.price = params.price;
        this.type = params.type;
        this.fillsId = params.fillsId;
        this.time = params.time;
        this.amount = params.amount;
        this.txHash = params.txHash;
        this.totalPaid = params.totalPaid;

    }

    @Field( )
    fillsId: string;

    @Field( )
    totalFee: number;

    @Field( )
    totalPaid: number;

    @Field( { nullable: true} )
    mangroveOrderId?: string;

    @Field( )
    taker: string;

    @Field( )
    type: string;

    @Field( )
    inbound: Token

    @Field( )
    outbound: Token

    @Field( )
    price: number;

    @Field( )
    amount: number;

    @Field( )
    time: Date;

    @Field( )
    txHash: string;
}


@ObjectType()
export class MangroveOrderOpenOrder {

    constructor(params: {
        mangroveOrderId: string,
        isBuy: boolean,
        isFailed: boolean,
        isFilled: boolean,
        offerId?: number
        taker: string,
        inboundToken?: Token,
        outboundToken?: Token,
        price?: number
        status?: "Cancelled" | "Failed" | "Filled" | "Partial Fill" | "Open",
        isOpen: boolean,
        failedReason?: string,
        expiryDate?: Date
        date: Date,
        filled?: number,
        amount: number,
        txHash: string
    }) {
        this.mangroveOrderId = params.mangroveOrderId
        this.isBuy = params.isBuy;
        this.isOpen = params.isOpen;
        this.isFailed = params.isFailed;
        this.isFilled = params.isFilled;
        this.offerId = params.offerId;
        this.taker = params.taker;
        this.inbound = params.inboundToken;
        this.outbound = params.outboundToken;
        this.price = params.price;
        this.status = params.status;
        this.failedReason = params.failedReason;
        this.expiryDate = params.expiryDate;
        this.date = params.date;
        this.filled = params.filled;
        this.amount = params.amount;
        this.txHash = params.txHash;

    }

    @Field( )
    mangroveOrderId!: string;

    @Field( )
    txHash!: string;

    @Field( )
    isBuy!: boolean;

    @Field( )
    isFailed!: boolean;

    @Field( )
    isFilled!: boolean;

    @Field( { nullable: true} )
    offerId?: number;

    @Field( )
    taker!: string;

    @Field( )
    inbound?: Token

    @Field( )
    outbound?: Token

    @Field( )
    price?: number;

    @Field( )
    status?: string;

    @Field( )
    isOpen!: boolean;

    @Field( { nullable: true} )
    failedReason?: string;

    @Field( { nullable: true} )
    expiryDate?: Date;

    @Field( )
    date!: Date;

    @Field( )
    filled?: number;

    @Field( )
    amount!: number;

}
