import { PrismaClient, Token } from "@prisma/client";
import BigNumber from "bignumber.js";
import { KandelId } from "src/state/model";
import { fromBigNumber } from "src/utils/numberUtils";

type returnTypes = {
    start: Date,
    end: Date,
    days: number,
    offeredPerOffer: Map<string, string>,
    offeredTotal: string,
    thisPeriod: {
        send: string,
        received: string,
        dif: string,
    },
    allTime:{
        send: string,
        received: string,
        dif: string,
    },
    return: number,
    returnDay: number
};

export type simpleToken = {
    id: string;
    decimals: number;
    symbol: string;
}

export type simplePrismaOfferVersion =  {
    offerId: string,
    gives: string,
    offer: {
        offerListing: {
            outboundToken: simpleToken
        }
    }
}

export type simpleOfferVersion = {
    offerId: string,
    gives: string,
    token: simpleToken
}

export type baseQuoteBalance = {
    baseSend: string,
    baseReceived: string,
    quoteSend: string,
    quoteReceived: string,
}

export type period = {
    start: Date,
    end: Date,
    type: "Retract" | "Populate"
    offers: simpleOfferVersion[],
} & baseQuoteBalance

export type rates = {
    base: {
        token: simpleToken;
        rate: number;
    };
    quote: {
        token: simpleToken;
        rate: number;
    };
}



export class KandelReturnUtils {

    async getKandelReturn(kandelId: KandelId, prisma: PrismaClient, rate: (token: Token) => Promise<number>) {
        const { rates, periods: periods } = await this.getData(kandelId, prisma, rate);
        if (!rates) {
            return "0";
        }
        return periods.length > 0 ? this.calculateReturn(periods, rates).toString() : "0";
    
    }
    
    calculateReturn(periods: period[], rates: rates) {
        const returns = periods.reduce((result, period, index) => {
            const { offeredTotal, offeredPerOffer } = this.getOfferedVolume(period, index, result, rates);
            const sendReceivedInfo = this.getSendReceivedAndDif(period, rates);
            const { send, received } = index > 0 ? { send: sendReceivedInfo.send.minus(result[index-1].allTime.send ), received: sendReceivedInfo.received.minus(result[index-1].allTime.received) } : sendReceivedInfo;
            const dif = received.minus(send);
            const days = this.getDays(period.end, period.start);
            const { returnForPeriod, returnDay } = this.getReturnForPeriod(dif, offeredTotal, days);
            return [...result,{
                start: period.start,
                end: period.end,
                days,
                offeredTotal: offeredTotal,
                offeredPerOffer: offeredPerOffer,
                thisPeriod: {
                    send: send.toString(),
                    received: received.toString(),
                    dif: dif.toString(),
                },
                allTime: {
                    send: sendReceivedInfo.send.toString(),
                    received: sendReceivedInfo.received.toString(),
                    dif: sendReceivedInfo.dif.toString(),
                },
                return: returnForPeriod.toNumber(),
                returnDay: returnDay.toNumber()
            }];
        }, [] as returnTypes[]);
        const totalDays =this.getDays(returns[returns.length - 1].end, returns[0].start);
        const returnDayTimesNumOfDays =returns.reduce((result, current, index) => result.plus(current.returnDay * current.days), new BigNumber(0));
        const avgReturnDay = returnDayTimesNumOfDays.div(totalDays);
        const avgReturnMonth = Math.pow(avgReturnDay.toNumber()+1, 365/12)-1;
        return avgReturnMonth;
    }
    
    async getData(kandelId: KandelId, prisma: PrismaClient, rate: (token: Token) => Promise<number>): Promise< { rates?:rates, periods: period[]}> {
        const tokens = await prisma.kandel.findUnique({ where: { id: kandelId.value }, select: { baseToken: true, quoteToken: true } });
        if (!tokens) {
            return { periods: [] }
        }
        const baseRate: number = await rate(tokens.baseToken);
        const quoteRate: number = await rate(tokens.quoteToken);
    
        const events = (await prisma.kandelEvent.findMany({
            where: { kandelId: kandelId.value, OR: [{ NOT: { KandelPopulateEvent: null } }, { NOT: { KandelRetractEvent: null } }] }, include: {
                transaction: { select: { time: true } },
                KandelPopulateEvent: {
                    include: {
                        KandelOfferUpdate: { select: { offerId: true, gives: true, offer: { select: { offerListing: { select: { outboundToken: { select: { id: true, decimals: true, symbol: true } } } } } } } }
                    }
                },
                KandelRetractEvent: {
                    include: {
                        KandelOfferUpdate: { select: { offerId: true, gives: true, offer: { select: { offerListing: { select: { outboundToken: { select: { id: true, decimals: true, symbol: true } } } } } } } }
                    }
                }
            },
            orderBy: { KandelVersion: { tx: { time: 'desc' } } },
        })).map( event => {return { ...event, End: null as unknown as baseQuoteBalance | null}})
    
        const last =  await prisma.account.findUnique({where:{ id: kandelId.value} , select: { TokenBalance: { where: { OR: [{ tokenId: tokens.baseToken.id }, {tokenId: tokens.quoteToken.id}] }, select: { token: true, currentVersion: { select :{ send: true, received: true} } } } } })
    
        const lastBase = last?.TokenBalance.find(v => v.token.id == tokens.baseToken.id)?.currentVersion;
        const lastQuote = last?.TokenBalance.find(v => v.token.id == tokens.quoteToken.id)?.currentVersion;
    
        const lastPeriod = lastBase && lastQuote ? {
            transaction: { time: new Date()},
            KandelPopulateEvent: null,
            KandelRetractEvent: null,
            End:{
                baseSend: lastBase.send,
                baseReceived: lastBase.received,
                quoteSend: lastQuote.send,
                quoteReceived: lastQuote.received,
            } as baseQuoteBalance
        } :null
    
    
        const periods:period[] = [...events, lastPeriod].reduce((result, current, index ) => {
            if(index==0 || !current){
                return result;
            }
            const previous = events[index-1];
    
            const type = previous.KandelPopulateEvent ? "Populate" : ( previous.KandelRetractEvent ? "Retract" : undefined ) ;
            if( !type){
                return result;
            }
            const eventForOffers = previous.KandelPopulateEvent ? previous.KandelPopulateEvent : ( previous.KandelRetractEvent ? previous.KandelRetractEvent :  undefined ) ;
            const eventForBalance = current.KandelPopulateEvent ? current.KandelPopulateEvent : ( current.KandelRetractEvent ? current.KandelRetractEvent :  (current.End ? current.End : undefined) ) ;
            eventForBalance
            return [...result,
                {
                    start: events[index-1].transaction.time,
                    end: current.transaction.time,
                    offers: eventForOffers ? eventForOffers.KandelOfferUpdate.map( this.convertOfferVersion ) : [] ,
                    type: type,
                    baseSend: eventForBalance ? eventForBalance.baseSend : "0",
                    baseReceived: eventForBalance ? eventForBalance.baseReceived : "0",
                    quoteSend: eventForBalance ? eventForBalance.quoteSend : "0",
                    quoteReceived: eventForBalance ? eventForBalance.quoteReceived : "0",
                }
             ];
        }, [] as period[])
    
    
    
        return {
            rates: {
                base: {
                    token: tokens.baseToken,
                    rate: baseRate
                },
                quote: {
                    token: tokens.quoteToken,
                    rate: quoteRate
                }
            }, periods
        }
    }
    
    convertOfferVersion( offer:simplePrismaOfferVersion):simpleOfferVersion{
        return {
            offerId: offer.offerId,
            gives: offer.gives,
            token: offer.offer.offerListing.outboundToken
        }
    }
    
    getOfferedVolume(
        period: period,
        index: number,
        previousReturns: {offeredPerOffer: Map<string,string>}[],
        rates: rates
    ): {
        offeredTotal: string;
        offeredPerOffer: Map<string, string>;
    } {
        const initalMap = index > 0 ? previousReturns[index - 1].offeredPerOffer : new Map<string, string>();
        const offeredPerOffer = period.offers.reduce((acc, current) => acc.set(current.offerId, this.getOfferGives(current, rates)), initalMap);
        const offeredTotal = Array.from(offeredPerOffer.values()).reduce((acc, current) => new BigNumber(acc).plus(current).toString(), "0");
        return { offeredTotal, offeredPerOffer };
    }
    
    getOfferGives(current: simpleOfferVersion, rates: {
        base: {
            token: simpleToken;
            rate: number;
        };
        quote: {
            token: simpleToken;
            rate: number;
        };
    }): string {
        return this.getTokenValueFromRate(current.gives, current.token, this.getCorrectRate(current.token, rates)).toString();
    }
    
    getCorrectRate(token: simpleToken, rates: rates) {
        if (rates.base.token.id == token.id) {
            return rates.base.rate;
        } else if (rates.quote.token.id == token.id) {
            return rates.quote.rate;
        }
        throw new Error(`Unknown rate for token: ${token.id}`)
    }
    
    getReturnForPeriod(
        dif: BigNumber,
        offeredTotal: string,
        days: number)
        : {
            returnForPeriod: BigNumber;
            returnDay: BigNumber;
        } {
        const returnForPeriod = new BigNumber( offeredTotal ).gt(0)  ? dif.div(offeredTotal) : new BigNumber(0);
        const returnDay =  Math.pow(returnForPeriod.toNumber()+1,1 / days)-1;
        return { returnForPeriod, returnDay: new BigNumber( returnDay ) };
    }
    
    getDays(endDate: Date, startDate: Date) {
        return (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    }
    
    getSendReceivedAndDif(
        period: period,
        rates: rates)
        : {
            dif: BigNumber;
            send: BigNumber;
            received: BigNumber;
        } {
        const send = (this.getTokenValueFromRate(period.baseSend, rates.base.token, rates.base.rate)).plus(this.getTokenValueFromRate(period.quoteSend, rates.quote.token, rates.quote.rate));
        const received = (this.getTokenValueFromRate(period.baseReceived, rates.base.token, rates.base.rate)).plus(this.getTokenValueFromRate(period.quoteReceived, rates.quote.token, rates.quote.rate));
        const dif = received.minus(send);
        return { dif, send, received };
    }
    
    getTokenBalanceNumber(number: { send: string, received: string } | null, sendOrReceived: "send" | "received") {
        return number ? number[sendOrReceived] : "0"
    }
    
    getTokenValueFromRate(
        number: string,
        token: simpleToken,
        rate: number
    ): BigNumber {
        return new BigNumber(fromBigNumber({ value: number, token })).times(rate);
    }
}

