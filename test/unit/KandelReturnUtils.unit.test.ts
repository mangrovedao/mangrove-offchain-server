import assert from "assert";
import {assert as chaiAssert} from "chai"
import { slice } from "lodash";
import { describe } from "mocha";
import { toBigNumber } from "src/utils/numberUtils";
import { KandelReturnUtils, baseQuoteBalance, period, simpleOfferVersion, simplePrismaOfferVersion } from "src/utils/KandelReturnUtils";
import BigNumber from "bignumber.js";


let baseToken = {
    id: "tokenA",
    decimals: 18,
    symbol: "A"
}
let quoteToken = {
    id: "tokenB",
    decimals: 6,
    symbol: "B"
}
let rates= {
    base: {
        token: baseToken,
        rate: 2
    }, quote: {
        token: quoteToken,
        rate: 1
    }
}

let kandelReturnUtils = new KandelReturnUtils();

const offers = [
    { offerId: "base-1", token: baseToken },
    { offerId: "base-2", token: baseToken },
    { offerId: "base-3", token: baseToken },
    { offerId: "base-4", token: baseToken },
    { offerId: "quote-1", token: quoteToken },
    { offerId: "quote-2", token: quoteToken },
    { offerId: "quote-3", token: quoteToken },
    { offerId: "quote-4", token: quoteToken },
]

describe("Kandel Return Unit test suite", () => {
    it(KandelReturnUtils.prototype.calculateReturn.name, () => {

        let periods: period[] = [];


        periods.push(createPeriod({ type: "Populate", start: new Date(2023, 0, 1), end: new Date(2023, 1, 10), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "10", token: v.token}).toString() } }), baseSend: "20", baseReceived: "22", quoteSend: "30", quoteReceived: "33" }))
        periods.push(createPeriod({ type: "Retract", start: new Date(2023, 1, 10), end: new Date(2023, 3, 23), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "0", token: v.token}).toString() } }), baseSend: "20", baseReceived: "22", quoteSend: "30", quoteReceived: "33" }))
        periods.push(createPeriod({ type: "Populate", start: new Date(2023, 3, 23), end: new Date(2023, 5, 25), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "5", token: v.token}).toString() } }), baseSend: "40", baseReceived: "46", quoteSend: "50", quoteReceived: "57" }))
        periods.push(createPeriod({ type: "Populate", start: new Date(2023, 5, 25), end: new Date(2023, 9, 27), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "20", token: v.token}).toString() } }), baseSend: "120", baseReceived: "134", quoteSend: "110", quoteReceived: "123" }))

        const avgReturn = kandelReturnUtils.calculateReturn(periods,rates)
        chaiAssert.closeTo(avgReturn, 0.0338, 0.0001)
    })

    it(KandelReturnUtils.prototype.convertOfferVersion.name, () => {
        let simplePrismaOffer:simplePrismaOfferVersion = {
            offerId: "offerId-1",
            gives: "10",
            offer:{
                offerListing: {
                    outboundToken: baseToken
                }
            }
        }
        const simpleOffer= kandelReturnUtils.convertOfferVersion(simplePrismaOffer);
        assert.deepStrictEqual( simpleOffer, {
            offerId: simplePrismaOffer.offerId,
            gives: simplePrismaOffer.gives,
            token: simplePrismaOffer.offer.offerListing.outboundToken
        })
    })

    describe(KandelReturnUtils.prototype.getOfferedVolume.name, () => {
        it("index > 0 ", () => {
            let index = 1;
            let period = createPeriod({ type: "Populate", start: new Date(2023, 0, 1), end: new Date(2023, 1, 10), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "10", token: v.token}).toString() } }), baseSend: "20", baseReceived: "22", quoteSend: "30", quoteReceived: "33" })
            let offeredPerOffer = period.offers.slice(0,3).reduce((result, current) => result.set(current.offerId, "2") ,new Map<string,string>() )
            let previous = [{ offeredPerOffer }]

            const result = kandelReturnUtils.getOfferedVolume(period, index, previous, rates);

            assert.strictEqual( result.offeredTotal, "120" )

        })
        it("index = 0 ", () => {
            let index = 0;
            let period = createPeriod({ type: "Populate", start: new Date(2023, 0, 1), end: new Date(2023, 1, 10), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "10", token: v.token}).toString() } }), baseSend: "20", baseReceived: "22", quoteSend: "30", quoteReceived: "33" })
            const result = kandelReturnUtils.getOfferedVolume(period, index, [], rates);

            assert.strictEqual( result.offeredTotal, "120" )
        })

    })

    it( KandelReturnUtils.prototype.getOfferGives.name, () => {
        let current:simpleOfferVersion = {
            offerId: "id",
            token: baseToken,
            gives: "1000000000000000000"
        }
        const gives =  kandelReturnUtils.getOfferGives(current, rates);

        assert.strictEqual(gives, "2")
    })

    describe(KandelReturnUtils.prototype.getCorrectRate.name, () => {
        it("get base rate", () => {
            const baseRate = kandelReturnUtils.getCorrectRate(baseToken, rates)
            assert.strictEqual(baseRate, rates.base.rate)
        })

        it("get quote rate", () => {
            const quoteRate = kandelReturnUtils.getCorrectRate(quoteToken, rates)
            assert.strictEqual(quoteRate, rates.quote.rate)
        })

        it("rate not found", () => {
            assert.throws( () => kandelReturnUtils.getCorrectRate({ id:"test", decimals: 1, symbol:"t" }, rates) )
        })
    })

    describe(KandelReturnUtils.prototype.getReturnForPeriod.name, () => {
        
        it("offeredTotal <= 0", () => {
            let dif = new BigNumber(10)
            let offerTotal = "0"
            let days = 10
            const result = kandelReturnUtils.getReturnForPeriod(dif, offerTotal, days )
            chaiAssert.closeTo( result.returnForPeriod.toNumber(), 0, 0 )
            chaiAssert.closeTo( result.returnDay.toNumber(), 0, 0 )

        } )

        it("offeredTotal > 0", () => {
            let dif = new BigNumber(100)
            let offerTotal = "15"
            let days = 13
            const result = kandelReturnUtils.getReturnForPeriod(dif, offerTotal, days )
            chaiAssert.closeTo( result.returnForPeriod.toNumber(), 6.6666, 0.0001 )
            chaiAssert.closeTo( result.returnDay.toNumber(), 0.16962, 0.00001 )

        } )
    })

    it(KandelReturnUtils.prototype.getDays.name, () => {
        let start = new Date(2023, 0, 1)
        let end = new Date(2024, 1, 3)
        const days = kandelReturnUtils.getDays(end, start);
        assert.strictEqual(days, 398)
    })

    it( KandelReturnUtils.prototype.getSendReceivedAndDif.name, () => {
        let period = createPeriod({ type: "Populate", start: new Date(2023, 0, 1), end: new Date(2023, 1, 10), offers: offers.map(v => { return { ...v, gives: toBigNumber({ value: "10", token: v.token}).toString() } }), baseSend: "20", baseReceived: "22", quoteSend: "30", quoteReceived: "33" })
        let result = kandelReturnUtils.getSendReceivedAndDif(period, rates)
        assert.strictEqual( result.dif.toNumber(), 7)
        assert.strictEqual( result.send.toNumber(), 70)
        assert.strictEqual( result.received.toNumber(), 77)
    })

    describe(KandelReturnUtils.prototype.getTokenBalanceNumber.name, () => {
        it("number is null", () => {
            assert.strictEqual(kandelReturnUtils.getTokenBalanceNumber(null, "received"), "0")
        })
        it("number != null + send", () => {
            let number = { send: "10", received:"20"}
            const send = kandelReturnUtils.getTokenBalanceNumber(number, "send")
            assert.strictEqual(send, "10")
        })
        it("number != null + send", () => {
            let number = { send: "10", received:"20"}
            const received = kandelReturnUtils.getTokenBalanceNumber(number, "received")
            assert.strictEqual(received, "20")
            
        })
    })

    it( KandelReturnUtils.prototype.getTokenValueFromRate.name, () => {
        let number = "10000000000";
        let token = quoteToken;
        let rate = 2;
        const tokenValue = kandelReturnUtils.getTokenValueFromRate(number, token, rate)
        assert.strictEqual(tokenValue.toNumber(), 20000)

    })

})

function createPeriod(params: { type: "Retract" | "Populate", start: Date, end: Date, offers: simpleOfferVersion[], baseSend: string, baseReceived: string, quoteSend: string, quoteReceived: string }): period {
    return {
        start: params.start,
        end: params.end,
        type: params.type,
        offers: params.offers,
        ...createBaseQuoteBalance(params)
    };
}

function createBaseQuoteBalance(params: { baseSend: string; baseReceived: string; quoteSend: string; quoteReceived: string; }): baseQuoteBalance {
    return {
        baseSend: toBigNumber({ value: params.baseSend, token: baseToken }).toString(),
        baseReceived:  toBigNumber({ value: params.baseReceived, token: baseToken }).toString(),
        quoteSend:  toBigNumber({ value: params.quoteSend, token: quoteToken }).toString(),
        quoteReceived: toBigNumber({ value: params.quoteReceived, token: quoteToken }).toString(),
    };
}

