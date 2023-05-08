import { KandelConfiguration, KandelVersion, OfferVersion, TokenBalanceVersion, Transaction } from "@prisma/client";
import assert from "assert";
import c from "config";
import { before, describe } from "mocha";
import { allDbOperations } from "src/state/dbOperations/allDbOperations";
import { KandelEventsLogic } from "src/state/handlers/stratsHandler/kandelEventsLogic";
import { AccountId, ChainId, KandelId, KandelVersionId, MangroveId, MangroveVersionId, OfferId, OfferListKey, OfferListingId, OfferListingVersionId, OfferVersionId, TokenBalanceId, TokenBalanceVersionId, TokenId } from "src/state/model";
import { Credit, Debit, KandelEvent, NewKandel, Populate, Retract, SetIndexMapping, SetParams } from "@proximaone/stream-schema-mangrove/dist/kandel";
import { prisma } from "utils/test/mochaHooks";


describe("Kandel Events Logic Integration test suite", () => {

    let kandelEventsLogic: KandelEventsLogic;

    before(() => {
        kandelEventsLogic = new KandelEventsLogic(allDbOperations(prisma), "stream");
    });
    const chainId = new ChainId(10);
    const mangroveId = new MangroveId(chainId, "mangroveid");
    const mangroveVersionId = new MangroveVersionId(mangroveId, 0);
    const ownerAddress = "owner"
    const reserve = "reserve"
    const router = "router"
    const kandelAddress = "kandelAddress"
    const tokenAId = new TokenId(chainId, "tokenA");
    const tokenBId = new TokenId(chainId, "tokenB");
    const offerListKeyAB: OfferListKey = {
        inboundToken: tokenAId.tokenAddress,
        outboundToken: tokenBId.tokenAddress
    }
    const offerListingIdAB = new OfferListingId(mangroveId, offerListKeyAB);
    const offerListingVersionIdAB = new OfferListingVersionId(offerListingIdAB, 0);

    const offerListKeyBA: OfferListKey = {
        inboundToken: tokenBId.tokenAddress,
        outboundToken: tokenAId.tokenAddress
    }
    const offerListingIdBA = new OfferListingId(mangroveId, offerListKeyBA);
    const offerListingVersionIdBA = new OfferListingVersionId(offerListingIdBA, 0);
    
    const kandelId = new KandelId(chainId, "newKandelAddress");
    const kandeVersionId = new KandelVersionId({kandelId, versionNumber:0})
    const reserveId = new AccountId(chainId, "reserveAddress");
    const tokenBalanceId = new TokenBalanceId({accountId:reserveId, tokenId: tokenAId, stream:"stream"});
    const tokenBalanceVersionId = new TokenBalanceVersionId({tokenBalanceId, versionNumber:0})
    const offerABId = new OfferId(mangroveId, offerListKeyAB, 1)
    const offerVersionIdAB = new OfferVersionId(offerABId, 0)

    const offerBAId = new OfferId(mangroveId, offerListKeyBA, 1)
    const offerVersionIdBA = new OfferVersionId(offerBAId, 0);
    
    let tx: Transaction;
    let tokenBalanceVersion:TokenBalanceVersion
    let offerVersionAB: OfferVersion;
    let offerVersionBA: OfferVersion;
    let kandelVersion: KandelVersion;
    


    beforeEach(async () => {


        tx = await prisma.transaction.create({
            data: {
                id: "txId",
                chainId: chainId.value,
                txHash: "txHash",
                from: "from",
                blockNumber: 101,
                blockHash: "blockHash",
                time: new Date(2010, 10)
            }
        })

        await prisma.mangrove.create({
            data: {
                id: mangroveId.value,
                chainId: chainId.value,
                address: "mangrove",
                currentVersionId: mangroveVersionId.value
            }
        })

        await prisma.token.create({
            data: {
                id: tokenAId.value,
                chainId: chainId.value,
                address: tokenAId.tokenAddress,
                symbol: "a",
                name: tokenAId.tokenAddress,
                decimals: 0
            }
        })

        await prisma.token.create({
            data: {
                id: tokenBId.value,
                chainId: chainId.value,
                address: tokenBId.tokenAddress,
                symbol: "b",
                name: tokenBId.tokenAddress,
                decimals: 0
            }
        })

        await prisma.offerListing.create({
            data: {
                id: offerListingIdAB.value,
                mangroveId: mangroveId.value,
                inboundTokenId: tokenAId.value,
                outboundTokenId: tokenBId.value,
                currentVersionId: offerListingVersionIdAB.value

            }
        })

        await prisma.offerListing.create({
            data: {
                id: offerListingIdBA.value,
                mangroveId: mangroveId.value,
                inboundTokenId: tokenBId.value,
                outboundTokenId: tokenAId.value,
                currentVersionId: offerListingVersionIdBA.value

            }
        })

        await prisma.offer.create( {data: {
            id: offerABId.value,
            offerNumber: offerABId.offerNumber,
            offerListingId: offerListingIdAB.value,
            mangroveId: mangroveId.value,
            makerId: kandelId.value,
            currentVersionId: offerVersionIdAB.value
        }})

       offerVersionAB = await prisma.offerVersion.create( { data: {
            id: offerVersionIdAB.value,
            offerId: offerABId.value,
            txId: tx.id,
            wants: "10",
            wantsNumber: 10,
            gives: "10",
            givesNumber: 10,
            gasprice: 10,
            gasreq: 6000,
            live: true,
            deprovisioned: false,
            versionNumber: 0,
        }})

        await prisma.offer.create( {data: {
            id: offerBAId.value,
            offerNumber: offerBAId.offerNumber,
            offerListingId: offerListingIdBA.value,
            mangroveId: mangroveId.value,
            makerId: kandelId.value,
            currentVersionId: offerVersionIdBA.value
        }})

        offerVersionBA = await prisma.offerVersion.create( { data: {
            id: offerVersionIdBA.value,
            offerId: offerBAId.value,
            txId: tx.id,
            wants: "10",
            wantsNumber: 10,
            gives: "10",
            givesNumber: 10,
            gasprice: 10,
            gasreq: 6000,
            live: true,
            deprovisioned: false,
            versionNumber: 0,
        }})

        await prisma.kandel.create({data: {
            id: kandelId.value,
            mangroveId:mangroveId.value,
            baseId: tokenAId.value,
            quoteId: tokenBId.value,
            reserveId: reserveId.value,
            type: "Kandel",
            currentVersionId: kandeVersionId.value
        }})

        kandelVersion =await prisma.kandelVersion.create({data: {
            id: kandeVersionId.value,
            kandelId:kandelId.value,
            txId: tx.id,
            congigurationId: "",
            adminId: "",
            routerAddress: router,
            versionNumber: 0
        }})

        await prisma.account.create({data: {
            id: reserveId.value,
            chainId:chainId.value,
            address: reserveId.address
        }})

        await prisma.account.create({data: {
            id: kandelId.value,
            chainId:chainId.value,
            address: kandelId.address
        }})

        await prisma.tokenBalance.create({ data: {
            id:tokenBalanceId.value,
            tokenId: tokenAId.value,
            accountId: reserveId.value,
            stream: "stream",
            currentVersionId: tokenBalanceVersionId.value
        }})

        tokenBalanceVersion = await prisma.tokenBalanceVersion.create({data: {
            id: tokenBalanceVersionId.value,
            tokenBalanceId: tokenBalanceId.value,
            txId: tx.id,
            deposit: "20",
            withdrawal: "10",
            send: "30",
            received: "40",
            balance: "20",
            versionNumber: tokenBalanceVersionId.params.versionNumber
        }})


    })

    describe(KandelEventsLogic.prototype.handleKandelCreated.name, () => {
        for (const reserveToUse of ["", reserve]) {
            it(`Create new Kandel and dependencies, hasReserve:${reserveToUse != ""}`, async () => {
                const hasReserve = reserveToUse != "";
                const event: NewKandel = {
                    type: "NewKandel",
                    mangroveId: mangroveId.value,
                    base: tokenAId.tokenAddress,
                    quote: tokenBId.tokenAddress,
                    owner: ownerAddress,
                    reserveId: reserveToUse,
                    kandel: kandelAddress,
                    params: {
                        type: "SetParams",
                        router: router,
                        compoundRates: {
                            base: 1,
                            quote: 2
                        },
                        gasPrice: "100",
                        gasReq: "65000"
                    }
                }
                const accountCount = await prisma.account.count()
                const kandelCount = await prisma.kandel.count()
                const kandeVersionCount = await prisma.kandelVersion.count()
                const kandelConfigCount = await prisma.kandelConfiguration.count()
                const kandelEventCount = await prisma.kandelEvent.count()
                const newKandelEventCount = await prisma.newKandelEvent.count()
                await kandelEventsLogic.handleKandelCreated(false, chainId, event, tx);
                assert.strictEqual(await prisma.account.count() - accountCount, hasReserve ? 2 : 1)
                assert.strictEqual(await prisma.kandel.count() - kandelCount, 1)
                assert.strictEqual(await prisma.kandelVersion.count() - kandeVersionCount, 1)
                assert.strictEqual(await prisma.kandelConfiguration.count() -kandelConfigCount , 1)
                assert.strictEqual(await prisma.kandelEvent.count() - kandelEventCount, 1)
                assert.strictEqual(await prisma.newKandelEvent.count() - newKandelEventCount, 1)

                const kandelId = new KandelId(chainId, event.kandel);
                const reserveId = hasReserve ? new AccountId(chainId, event.reserveId) : kandelId;
                const adminId = new AccountId(chainId, event.owner);
                const kandel = await prisma.kandel.findUnique({ where: { id: kandelId.value } });
                const kandelVersion = await prisma.kandelVersion.findUnique({ where: { id: kandel?.currentVersionId } });
                const config = await prisma.kandelConfiguration.findUnique({ where: { id: kandelVersion?.congigurationId } })
                const kandelAccount = await prisma.account.findUnique({ where: { id: kandelId.value } })
                const reserveAccount = await prisma.account.findUnique({ where: { id: reserveId.value } })
                assert.deepStrictEqual(kandel, {
                    id: kandelId.value,
                    reserveId: reserveId.value,
                    mangroveId: mangroveId.value,
                    baseId: tokenAId.value,
                    quoteId: tokenBId.value,
                    type: event.type,
                    currentVersionId: kandel?.currentVersionId
                })
                assert.deepStrictEqual(kandelVersion, {
                    id: kandelVersion?.id,
                    txId: tx.id,
                    kandelId: kandelId.value,
                    congigurationId: config?.id,
                    adminId: adminId.value,
                    routerAddress: event.params.router,
                    prevVersionId: null,
                    versionNumber: 0
                })
                assert.deepStrictEqual(config, {
                    id: config?.id,
                    compoundRateBase: event.params.compoundRates?.base,
                    compoundRateQuote: event.params.compoundRates?.quote,
                    gasPrice: event.params.gasPrice,
                    gasReq: event.params.gasReq,
                    spread: 0,
                    ratio: 0,
                    length: 0
                })
                assert.deepStrictEqual(kandelAccount, {
                    id: kandelId.value,
                    chainId: chainId.value,
                    address: kandelId.address
                })
                assert.deepStrictEqual(reserveAccount, {
                    id: reserveId.value,
                    chainId: chainId.value,
                    address: reserveId.address
                })
            })
        }
        it(`Undo created kandel`, async () => {
            const event: NewKandel = {
                type: "NewKandel",
                mangroveId: mangroveId.value,
                base: tokenAId.tokenAddress,
                quote: tokenBId.tokenAddress,
                owner: ownerAddress,
                reserveId: reserve,
                kandel: kandelAddress,
                params: {
                    type: "SetParams",
                    router: router,
                    compoundRates: {
                        base: 1,
                        quote: 2
                    },
                    gasPrice: "100",
                    gasReq: "65000"
                }
            }
            await kandelEventsLogic.handleKandelCreated(false, chainId, event, tx);

            const accountCount = await prisma.account.count()
            const kandelCount = await prisma.kandel.count()
            const kandeVersionCount = await prisma.kandelVersion.count()
            const kandelConfigCount = await prisma.kandelConfiguration.count()
            const kandelEventCount = await prisma.kandelEvent.count()
            const newKandelEventCount = await prisma.newKandelEvent.count()
            await kandelEventsLogic.handleKandelCreated(true, chainId, event, tx);
            assert.strictEqual( await prisma.account.count() - accountCount, -1) // the reserve account is not deleted
            assert.strictEqual(await prisma.kandel.count() - kandelCount, -1)
            assert.strictEqual(await prisma.kandelVersion.count() - kandeVersionCount, -1)
            assert.strictEqual(await prisma.kandelConfiguration.count() -kandelConfigCount , -1)
            assert.strictEqual(await prisma.kandelEvent.count() - kandelEventCount, -1)
            assert.strictEqual(await prisma.newKandelEvent.count() - newKandelEventCount, -1)

        });
    })

    it(KandelEventsLogic.prototype.mapSetParamsToKandelConfiguration.name, () => {
        const event: NewKandel = {
            type: "NewKandel",
            mangroveId: mangroveId.value,
            base: tokenAId.tokenAddress,
            quote: tokenBId.tokenAddress,
            owner: ownerAddress,
            reserveId: reserve,
            kandel: kandelAddress,
            params: {
                type: "SetParams",
                router: router,
                compoundRates: {
                    base: 1,
                    quote: 2
                },
                gasPrice: "100",
                gasReq: "65000"
            }
        }
        const config = kandelEventsLogic.mapSetParamsToKandelConfiguration(event.params);
        assert.deepStrictEqual(config, {
            compoundRateBase: event.params.compoundRates?.base,
            compoundRateQuote: event.params.compoundRates?.quote,
            gasPrice: event.params.gasPrice,
            gasReq: event.params.gasReq,
            ratio: 0,
            spread: 0,
            length: 0
        })
    })

    describe(KandelEventsLogic.prototype.handleKandelParamsUpdated.name, () => {
        it("new config ", async () => {
            const newKandelEvent: NewKandel = {
                type: "NewKandel",
                mangroveId: mangroveId.value,
                base: tokenAId.tokenAddress,
                quote: tokenBId.tokenAddress,
                owner: ownerAddress,
                reserveId: reserve,
                kandel: kandelAddress,
                params: {
                    type: "SetParams",
                    router: router,
                    compoundRates: {
                        base: 1,
                        quote: 2
                    },
                    gasPrice: "100",
                    gasReq: "65000"
            }
            }
            await kandelEventsLogic.handleKandelCreated(false, chainId, newKandelEvent, tx);
            const params: SetParams = {
                type: "SetParams",
                compoundRates: {
                    base: 3,
                    quote: 4
                },
                gasPrice: "200",
                gasReq: "15000",
                geometric: {
                    spread: 3,
                    ratio: 2
                },
                length: 1
            }
            const kandelCount = await prisma.kandel.count()
            const kandelVersionCount = await prisma.kandelVersion.count()
            const kandelConfigCount = await prisma.kandelConfiguration.count()
            const kandelEventCount = await prisma.kandelEvent.count()
            const KandelGasReqEventCount = await prisma.kandelGasReqEvent.count();
            const kandelId =new KandelId(chainId, kandelAddress)
            await kandelEventsLogic.handleKandelParamsUpdated(false, kandelId, params, tx)
            assert.strictEqual(await prisma.kandel.count() - kandelCount, 0)
            assert.strictEqual(await prisma.kandelVersion.count() - kandelVersionCount, 1)
            assert.strictEqual(await prisma.kandelConfiguration.count() - kandelConfigCount, 1)
            assert.strictEqual(await prisma.kandelEvent.count() - kandelEventCount, 1)
            assert.strictEqual(await prisma.kandelGasReqEvent.count() - KandelGasReqEventCount,1)
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber:1 })
            const newConfig = await prisma.kandelVersion.findUnique({where: {id: kandelVersionId.value}}).configuration();
            assert.deepStrictEqual( newConfig,  {
                id: newConfig?.id,
                compoundRateBase: params.compoundRates?.base,
                compoundRateQuote: params.compoundRates?.quote,
                gasPrice: params.gasPrice,
                gasReq: params.gasReq,
                spread: params.geometric?.spread,
                ratio: params.geometric?.ratio,
                length: params.length
            })
            const gasReqEvent = await prisma.kandelEvent.findFirst({where: { kandelVersionId: kandelVersionId.value}}).KandelGasReqEvent()
            assert.deepStrictEqual(gasReqEvent, {
                id: gasReqEvent?.id,
                eventId: gasReqEvent?.eventId,
                gasReq: params.gasReq
            })
        } )

        it("undo config ", async () => {
            const newKandelEvent: NewKandel = {
                type: "NewKandel",
                mangroveId: mangroveId.value,
                base: tokenAId.tokenAddress,
                quote: tokenBId.tokenAddress,
                owner: ownerAddress,
                reserveId: reserve,
                kandel: kandelAddress,
                params: {
                    type: "SetParams",
                    router: router,
                    compoundRates: {
                        base: 1,
                        quote: 2
                    },
                    gasPrice: "100",
                    gasReq: "65000"
                }
            }
            await kandelEventsLogic.handleKandelCreated(false, chainId, newKandelEvent, tx);
            const params: SetParams = {
                type: "SetParams",
                compoundRates: {
                    base: 3,
                    quote: 4
                },
                gasPrice: "200",
                gasReq: "15000",
                geometric: {
                    spread: 3,
                    ratio: 2
                },
                length: 1
            }

            const kandelId =new KandelId(chainId, kandelAddress)
            await kandelEventsLogic.handleKandelParamsUpdated(false, kandelId, params, tx)
            const kandelCount = await prisma.kandel.count()
            const kandelVersionCount = await prisma.kandelVersion.count()
            const kandelConfigCount = await prisma.kandelConfiguration.count()
            const kandelEventCount = await prisma.kandelEvent.count()
            const KandelGasReqEventCount = await prisma.kandelGasReqEvent.count();
            await kandelEventsLogic.handleKandelParamsUpdated(true, kandelId, params, tx)
            assert.strictEqual(await prisma.kandel.count() - kandelCount, 0)
            assert.strictEqual(await prisma.kandelVersion.count() - kandelVersionCount, -1)
            assert.strictEqual(await prisma.kandelConfiguration.count() - kandelConfigCount, -1)
            assert.strictEqual(await prisma.kandelEvent.count() - kandelEventCount, -1)
            assert.strictEqual(await prisma.kandelGasReqEvent.count() - KandelGasReqEventCount,-1)


        });
    })

    describe( KandelEventsLogic.prototype.getKandelConfigWithOverrides.name, () => {
        it("has overrides", () =>  {
            const params: SetParams = {
                type: "SetParams",
                compoundRates: {
                    base: 3,
                    quote: 4
                },
                gasPrice: "200",
                gasReq: "15000",
                geometric: {
                    spread: 3,
                    ratio: 2
                },
                length: 1
            }
            const existingConfig = {
                compoundRateBase: 0,
                compoundRateQuote: 0,
                gasPrice: "",
                gasReq: "",
                spread: 0,
                ratio: 0,
                length: 0,
            }
            const newConfig = kandelEventsLogic.getKandelConfigWithOverrides( existingConfig , params);
            assert.deepStrictEqual( newConfig, {
                compoundRateBase: params.compoundRates?.base,
                compoundRateQuote: params.compoundRates?.quote,
                gasPrice: params.gasPrice,
                gasReq: params.gasReq,
                spread: params.geometric?.spread,
                ratio: params.geometric?.ratio,
                length: params.length,
            } )
        })

        it("has no overrides", () =>  {
            const params: SetParams = {
                type: "SetParams",
            }
            const existingConfig = {
                compoundRateBase: 0,
                compoundRateQuote: 0,
                gasPrice: "",
                gasReq: "",
                spread: 0,
                ratio: 0,
                length: 0,
            }
            const newConfig = kandelEventsLogic.getKandelConfigWithOverrides( existingConfig , params);
            assert.deepStrictEqual( newConfig,  existingConfig )
        })
    })

    describe( KandelEventsLogic.prototype.createKandelParamsEvent.name, () => {
        it("Match gasreq", async () => {
            const params: SetParams = {
                type: "SetParams",
                gasReq: "15000",
            }
            const kandelId = new KandelId(chainId, kandelAddress);
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber: 0});
            assert.strictEqual( await prisma.kandelEvent.count(), 0);
            assert.strictEqual( await prisma.kandelGasReqEvent.count(), 0);
            const event = await kandelEventsLogic.createKandelParamsEvent(kandelId, kandelVersionId, params, "txId");
            assert.strictEqual( await prisma.kandelEvent.count(), 1);
            assert.strictEqual( await prisma.kandelGasReqEvent.count(), 1);
            const prismaEvent = await prisma.kandelEvent.findFirst({where: {kandelVersionId: kandelVersionId.value}}).KandelGasReqEvent();
            assert.deepStrictEqual(event, prismaEvent)
            assert.strictEqual(event.gasReq, params.gasReq)
        })
        it("Match gasprice", async () => {
            const params: SetParams = {
                type: "SetParams",
                gasPrice: "150",
            }
            const kandelId = new KandelId(chainId, kandelAddress);
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber: 0});
            assert.strictEqual( await prisma.kandelEvent.count(), 0);
            assert.strictEqual( await prisma.kandelGasPriceEvent.count(), 0);
            const event = await kandelEventsLogic.createKandelParamsEvent(kandelId, kandelVersionId, params, "txId");
            assert.strictEqual( await prisma.kandelEvent.count(), 1);
            assert.strictEqual( await prisma.kandelGasPriceEvent.count(), 1);
            const prismaEvent = await prisma.kandelEvent.findFirst({where: {kandelVersionId: kandelVersionId.value}}).gasPriceEvent();
            assert.deepStrictEqual(event, prismaEvent)
            assert.strictEqual(event.gasPrice, params.gasPrice)
        })

        it("Match length", async () => {
            const params: SetParams = {
                type: "SetParams",
                length: 10,
            }
            const kandelId = new KandelId(chainId, kandelAddress);
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber: 0});
            assert.strictEqual( await prisma.kandelEvent.count(), 0);
            assert.strictEqual( await prisma.kandelLengthEvent.count(), 0);
            const event = await kandelEventsLogic.createKandelParamsEvent(kandelId, kandelVersionId, params, "txId");
            assert.strictEqual( await prisma.kandelEvent.count(), 1);
            assert.strictEqual( await prisma.kandelLengthEvent.count(), 1);
            const prismaEvent = await prisma.kandelEvent.findFirst({where: {kandelVersionId: kandelVersionId.value}}).KandelLengthEvent();
            assert.deepStrictEqual(event, prismaEvent)
            assert.strictEqual(event.length, params.length)

        })

        it("Match compoundRates", async () => {
            const params: SetParams = {
                type: "SetParams",
                compoundRates: {
                    base: 3,
                    quote: 4
                },
            }
            const kandelId = new KandelId(chainId, kandelAddress);
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber: 0});
            assert.strictEqual( await prisma.kandelEvent.count(), 0);
            assert.strictEqual( await prisma.kandelCompoundRateEvent.count(), 0);
            const event = await kandelEventsLogic.createKandelParamsEvent(kandelId, kandelVersionId, params, "txId");
            assert.strictEqual( await prisma.kandelEvent.count(), 1);
            assert.strictEqual( await prisma.kandelCompoundRateEvent.count(), 1);
            const prismaEvent = await prisma.kandelEvent.findFirst({where: {kandelVersionId: kandelVersionId.value}}).compoundRateEvent();
            assert.deepStrictEqual(event, prismaEvent)
            assert.strictEqual(event.compoundRateBase, params.compoundRates?.base)
            assert.strictEqual(event.compoundRateQuote, params.compoundRates?.quote)
        })

        it("Match geometric", async () => {
            const params: SetParams = {
                type: "SetParams",
                geometric: {
                    spread: 3,
                    ratio: 4
                },
            }
            const kandelId = new KandelId(chainId, kandelAddress);
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber: 0});
            assert.strictEqual( await prisma.kandelEvent.count(), 0);
            assert.strictEqual( await prisma.kandelGeometricParamsEvent.count(), 0);
            const event = await kandelEventsLogic.createKandelParamsEvent(kandelId, kandelVersionId, params, "txId");
            assert.strictEqual( await prisma.kandelEvent.count(), 1);
            assert.strictEqual( await prisma.kandelGeometricParamsEvent.count(), 1);
            const prismaEvent = await prisma.kandelEvent.findFirst({where: {kandelVersionId: kandelVersionId.value}}).KandelGeometricParamsEvent();
            assert.deepStrictEqual(event, prismaEvent)
            assert.strictEqual(event.spread, params.geometric?.spread)
            assert.strictEqual(event.ratio, params.geometric?.ratio)
        })

        it("No Match", async () => {
            const params: SetParams = {
                type: "SetParams",
            }
            const kandelId = new KandelId(chainId, kandelAddress);
            const kandelVersionId = new KandelVersionId({kandelId, versionNumber: 0});
            await assert.rejects(  kandelEventsLogic.createKandelParamsEvent(kandelId, kandelVersionId, params, "txId"), new Error( `Could not find correct kandel event: ${ JSON.stringify( params )}` ) ) ;
        })
    })

    describe( KandelEventsLogic.prototype.handleDepositWithdrawal.name, () => {
        it("Credit", async () => {
            const event: Credit = {
                type:"Credit",
                token: tokenAId.tokenAddress,
                amount: "10"
            }
            const tokenBalanceCount = await prisma.tokenBalance.count()
            const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count()
            const tokenBalanceEventCount = await prisma.tokenBalanceEvent.count()
            const tokenBalanceDepositCount = await prisma.tokenBalanceDepositEvent.count()
            await kandelEventsLogic.handleDepositWithdrawal(false, kandelId, event, tx);
            assert.strictEqual( await prisma.tokenBalance.count() - tokenBalanceCount, 0);
            assert.strictEqual( await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, 1);
            assert.strictEqual( await prisma.tokenBalanceEvent.count() - tokenBalanceEventCount, 1);
            assert.strictEqual( await prisma.tokenBalanceDepositEvent.count() - tokenBalanceDepositCount, 1);
            const newtokenBalanceVersionId = new TokenBalanceVersionId({ tokenBalanceId, versionNumber: 1 });
            const newVersion = await prisma.tokenBalanceVersion.findUnique({where: {id: newtokenBalanceVersionId.value}})
            assert.deepStrictEqual( newVersion, { ...tokenBalanceVersion,
                deposit: "30",
                balance: "30",
                versionNumber: 1,
                id: newtokenBalanceVersionId.value,
                prevVersionId: tokenBalanceVersionId.value
             } )

        })

        it("Debit", async () => {
            const event: Debit = {
                type:"Debit",
                token: tokenAId.tokenAddress,
                amount: "10"
            }
            const tokenBalanceCount = await prisma.tokenBalance.count()
            const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count()
            const tokenBalanceEventCount = await prisma.tokenBalanceEvent.count()
            const tokenBalanceWithdrawCount = await prisma.tokenBalanceWithdrawalEvent.count()
            await kandelEventsLogic.handleDepositWithdrawal(false, kandelId, event, tx);
            assert.strictEqual( await prisma.tokenBalance.count() - tokenBalanceCount, 0);
            assert.strictEqual( await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, 1);
            assert.strictEqual( await prisma.tokenBalanceEvent.count() - tokenBalanceEventCount, 1);
            assert.strictEqual( await prisma.tokenBalanceWithdrawalEvent.count() - tokenBalanceWithdrawCount, 1);
            const newtokenBalanceVersionId = new TokenBalanceVersionId({ tokenBalanceId, versionNumber: 1 });
            const newVersion = await prisma.tokenBalanceVersion.findUnique({where: {id: newtokenBalanceVersionId.value}})
            assert.deepStrictEqual( newVersion, { ...tokenBalanceVersion,
                withdrawal: "20",
                balance: "10",
                versionNumber: 1,
                id: newtokenBalanceVersionId.value,
                prevVersionId: tokenBalanceVersionId.value
             } )

        })

        it("undo", async () => {
            const event: Debit = {
                type:"Debit",
                token: tokenAId.tokenAddress,
                amount: "10"
            }

            await kandelEventsLogic.handleDepositWithdrawal(false, kandelId, event, tx);


            const tokenBalanceCount = await prisma.tokenBalance.count()
            const tokenBalanceVersionCount = await prisma.tokenBalanceVersion.count()
            const tokenBalanceEventCount = await prisma.tokenBalanceEvent.count()
            const tokenBalanceWithdrawCount = await prisma.tokenBalanceWithdrawalEvent.count()
            await kandelEventsLogic.handleDepositWithdrawal(true, kandelId, event, tx);
            assert.strictEqual( await prisma.tokenBalance.count() - tokenBalanceCount, 0);
            assert.strictEqual( await prisma.tokenBalanceVersion.count() - tokenBalanceVersionCount, -1);
            assert.strictEqual( await prisma.tokenBalanceEvent.count() - tokenBalanceEventCount, -1);
            assert.strictEqual( await prisma.tokenBalanceWithdrawalEvent.count() - tokenBalanceWithdrawCount, -1);


        })
    } )

    describe( KandelEventsLogic.prototype.handelRetractOffers.name, () => {
        it( "retract", async () => {
            const event: Retract = {
                
                type: "Retract",
                // address: kandelId.address,
                offers: [
                    {
                        type: "OfferRetracted",
                        offerId: 1,
                        offerList: {
                            inboundToken: tokenAId.tokenAddress,
                            outboundToken: tokenBId.tokenAddress
                        }
                    },
                    {
                        type: "OfferRetracted",
                        offerId: 1,
                        offerList: {
                            inboundToken: tokenBId.tokenAddress,
                            outboundToken: tokenAId.tokenAddress
                        }
                    }
                ]
            }
            const kandelEventCount = await prisma.kandelEvent.count();
            const kandelRetractEventCount = await prisma.kandelRetractEvent.count();
            const kandelOfferUpdates = await  prisma.kandelOfferUpdate.count();
            await kandelEventsLogic.handelRetractOffers(false, kandelId, event, tx);
            assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, 1 )
            assert.strictEqual( await prisma.kandelRetractEvent.count() - kandelRetractEventCount, 1 )
            assert.strictEqual( await prisma.kandelOfferUpdate.count() - kandelOfferUpdates, 2 )
            const kandelUpdateOfferAB = await prisma.kandelOfferUpdate.findFirst({where: { offerId: offerABId.value}})
            const kandelUpdateOfferBA = await prisma.kandelOfferUpdate.findFirst({where: { offerId: offerBAId.value}})
            assert.notStrictEqual(kandelUpdateOfferAB, null )
            assert.notStrictEqual(kandelUpdateOfferBA, null )
            const kandelRetractEvent = await prisma.kandelRetractEvent.findUnique({where: {id: kandelUpdateOfferAB?.eventId }});
            assert.notStrictEqual(kandelRetractEvent, null )
            const kandelEvent = await prisma.kandelEvent.findUnique({where: {id: kandelRetractEvent?.eventId ?? undefined }});
            assert.notStrictEqual(kandelEvent, null )
            assert.deepStrictEqual( kandelUpdateOfferAB, { 
                eventId: kandelRetractEvent?.id,
                offerId: offerABId.value,
                gives: "0"
             } )

             assert.deepStrictEqual( kandelUpdateOfferBA, { 
                eventId: kandelRetractEvent?.id,
                offerId: offerBAId.value,
                gives: "0"
             } )

        } )

        it( "undo retract", async () => {
            const event: Retract = {
                type: "Retract",
                // kandelAddress: kandelId.address,
                offers: [
                    {
                        type: "OfferRetracted",
                        offerId: 1,
                        offerList: {
                            inboundToken: tokenAId.tokenAddress,
                            outboundToken: tokenBId.tokenAddress
                        }
                    },
                    {
                        type: "OfferRetracted",
                        offerId: 1,
                        offerList: {
                            inboundToken: tokenBId.tokenAddress,
                            outboundToken: tokenAId.tokenAddress
                        }
                    }
                ]
            }
            await kandelEventsLogic.handelRetractOffers(false, kandelId, event, tx);

            const kandelEventCount = await prisma.kandelEvent.count();
            const kandelRetractEventCount = await prisma.kandelRetractEvent.count();
            const kandelOfferUpdateCount = await  prisma.kandelOfferUpdate.count();
            await kandelEventsLogic.handelRetractOffers(true, kandelId, event, tx);
            assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, -1 )
            assert.strictEqual( await prisma.kandelRetractEvent.count() - kandelRetractEventCount, -1 )
            assert.strictEqual( await prisma.kandelOfferUpdate.count() - kandelOfferUpdateCount, -2 )
        } )
    })

    describe( KandelEventsLogic.prototype.handlePopulate.name, () => {
        it( "populate", async () => {
            const event: Populate = {
                type: "Populate",
                // kandelAddress: kandelId.address,
                offers: [
                    {
                        type: "OfferWritten",
                        maker: kandelId.address,
                        offer: {
                            id: 1,
                            prev: 0,
                            wants: "20",
                            gives: "20",
                            gasprice: 100,
                            gasreq: 500
                        },
                        offerList: {
                            inboundToken: tokenAId.tokenAddress,
                            outboundToken: tokenBId.tokenAddress
                        }
                    },
                    {
                        type: "OfferWritten",
                        maker: kandelId.address,
                        offer: {
                            id: 1,
                            prev: 0,
                            wants: "20",
                            gives: "20",
                            gasprice: 100,
                            gasreq: 500
                        },
                        offerList: {
                            inboundToken: tokenBId.tokenAddress,
                            outboundToken: tokenAId.tokenAddress
                        }
                    }
                ],
                indexMapping: [
                    {
                        type: "SetIndexMapping",
                        ba: 0,
                        index: 1,
                        offerId: 1
                    },
                    {
                        type: "SetIndexMapping",
                        ba: 1,
                        index: 2,
                        offerId: 1
                    }
                ]
            }
            const kandelEventCount = await prisma.kandelEvent.count();
            const kandelPopulateEventCount = await prisma.kandelPopulateEvent.count();
            const kandelOfferIndexCount = await prisma.kandelOfferIndex.count();
            const kandelUpdateOfferCount = await  prisma.kandelOfferUpdate.count();
            await kandelEventsLogic.handlePopulate(false, kandelId, event, tx);
            assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, 1 )
            assert.strictEqual( await prisma.kandelPopulateEvent.count() - kandelPopulateEventCount, 1 )
            assert.strictEqual( await prisma.kandelOfferIndex.count() - kandelOfferIndexCount, 2 )
            assert.strictEqual( await prisma.kandelOfferUpdate.count() - kandelUpdateOfferCount, 2 )
            const kandelOfferUpdateAB = await prisma.kandelOfferUpdate.findFirst({where: {offerId: offerABId.value}})
            const kandelOfferUpdateBA = await prisma.kandelOfferUpdate.findFirst({where: {offerId: offerBAId.value}})
            assert.notStrictEqual(kandelOfferUpdateAB, null )
            const kandelPopulateEvent = await prisma.kandelPopulateEvent.findUnique({where: {id: kandelOfferUpdateAB?.eventId }});
            assert.notStrictEqual(kandelPopulateEvent, null )
            const kandelEvent = await prisma.kandelEvent.findUnique({where: {id: kandelPopulateEvent?.eventId ?? undefined }});
            assert.notStrictEqual(kandelEvent, null )
            const kandelIndexOfferAB = await prisma.kandelOfferIndex.findUnique({where: { offerId_kandelId_ba: {
                kandelId: kandelId.value,
                offerId: offerABId.value,
                ba: "bid"
            } }})
            assert.notStrictEqual(kandelIndexOfferAB, null )
            assert.deepStrictEqual( kandelIndexOfferAB?.index, event.indexMapping[0].index)
            const kandelIndexOfferBA = await prisma.kandelOfferIndex.findUnique({where: { offerId_kandelId_ba: {
                kandelId: kandelId.value,
                offerId: offerBAId.value,
                ba: "ask"
            } }})
            assert.notStrictEqual(kandelIndexOfferBA, null )
            assert.deepStrictEqual( kandelIndexOfferBA?.index, event.indexMapping[1].index)
            assert.deepStrictEqual( kandelOfferUpdateAB, { 
                offerId: kandelOfferUpdateAB?.offerId,
                eventId: kandelOfferUpdateAB?.eventId,
                gives: "20",
             } )

             assert.deepStrictEqual( kandelOfferUpdateBA, { 
                offerId: kandelOfferUpdateBA?.offerId,
                eventId: kandelOfferUpdateBA?.eventId,
                gives: "20",
             } )

        } ),
        it( "undo populate", async () => {
            const event: Populate = {
                type: "Populate",
                // kandelAddress: kandelId.address,
                offers: [
                    {
                        type: "OfferWritten",
                        maker: kandelId.address,
                        offer: {
                            id: 2,
                            prev: 0,
                            wants: "20",
                            gives: "20",
                            gasprice: 100,
                            gasreq: 500
                        },
                        offerList: {
                            inboundToken: tokenAId.tokenAddress,
                            outboundToken: tokenBId.tokenAddress
                        }
                    },
                    {
                        type: "OfferWritten",
                        maker: kandelId.address,
                        offer: {
                            id: 2,
                            prev: 0,
                            wants: "20",
                            gives: "20",
                            gasprice: 100,
                            gasreq: 500
                        },
                        offerList: {
                            inboundToken: tokenBId.tokenAddress,
                            outboundToken: tokenAId.tokenAddress
                        }
                    }
                ],
                indexMapping: [
                    {
                        type: "SetIndexMapping",
                        ba: 0,
                        index: 1,
                        offerId: 2
                    },
                    {
                        type: "SetIndexMapping",
                        ba: 1,
                        index: 2,
                        offerId: 2
                    }
                ]
            }
            await kandelEventsLogic.handlePopulate(false, kandelId, event, tx);


            const kandelEventCount = await prisma.kandelEvent.count();
            const kandelPopulateEventCount = await prisma.kandelPopulateEvent.count();
            const kandelOfferUpdateCount = await  prisma.kandelOfferUpdate.count();
            await kandelEventsLogic.handlePopulate(true, kandelId, event, tx);
            assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, -1 )
            assert.strictEqual( await prisma.kandelPopulateEvent.count() - kandelPopulateEventCount, -1 )
            assert.strictEqual( await prisma.kandelOfferUpdate.count() - kandelOfferUpdateCount, -2 )

        } )
    })

    describe( KandelEventsLogic.prototype.handleOfferIndex.name, () => {
        it( "new Offer index, ba = 1 ", async () => {
            const event: SetIndexMapping = {
                type: "SetIndexMapping",
                ba: 1,
                index: 1,
                offerId: 1
            }
            const offerIndexCount = await prisma.kandelOfferIndex.count();

            await kandelEventsLogic.handleOfferIndex(false, kandelId, event, tx)

            assert.strictEqual( await prisma.kandelOfferIndex.count() - offerIndexCount, 1);
            const offerIndex = await prisma.kandelOfferIndex.findUnique({where: { offerId_kandelId_ba: {
                kandelId: kandelId.value,
                offerId: offerBAId.value,
                ba: "ask"
            }}})
            assert.notStrictEqual( offerIndex, null),
            assert.strictEqual( offerIndex?.index, 1);
        } )

        it( "undo new Offer index, ba = 1 ", async () => {
            const event: SetIndexMapping = {
                type: "SetIndexMapping",
                ba: 1,
                index: 1,
                offerId: 1
            }
            await kandelEventsLogic.handleOfferIndex(false, kandelId, event, tx)
            const offerIndexCount = await prisma.kandelOfferIndex.count();
            await kandelEventsLogic.handleOfferIndex(true, kandelId, event, tx)

            assert.strictEqual( await prisma.kandelOfferIndex.count() - offerIndexCount, -1);
        } )

        it( "new Offer index, ba = 0 ", async () => {
            const event: SetIndexMapping = {
                type: "SetIndexMapping",
                ba: 0,
                index: 1,
                offerId: 1
            }
            const offerIndexCount = await prisma.kandelOfferIndex.count();

            await kandelEventsLogic.handleOfferIndex(false, kandelId, event, tx)

            assert.strictEqual( await prisma.kandelOfferIndex.count() - offerIndexCount, 1);
            const offerIndex = await prisma.kandelOfferIndex.findUnique({where: { offerId_kandelId_ba: {
                kandelId: kandelId.value,
                offerId: offerABId.value,
                ba: "bid"
            }}})
            assert.notStrictEqual( offerIndex, null),
            assert.strictEqual( offerIndex?.index, 1);
        } )

        it( "undo new Offer index, ba = 0 ", async () => {
            const event: SetIndexMapping = {
                type: "SetIndexMapping",
                ba: 0,
                index: 1,
                offerId: 1
            }
            await kandelEventsLogic.handleOfferIndex(false, kandelId, event, tx)
            const offerIndexCount = await prisma.kandelOfferIndex.count();
            await kandelEventsLogic.handleOfferIndex(true, kandelId, event, tx)

            assert.strictEqual( await prisma.kandelOfferIndex.count() - offerIndexCount, -1);
        } )
    })

    // describe( KandelEventsLogic.prototype.handleSetAdmin.name, () => {
    //     it("Set admin", async () => {
    //         const event: SetAdmin = {
    //             type: "SetAdmin",
    //             admin: "admin"
    //         }

    //         const kandelCount = await prisma.kandel.count();
    //         const kandelVersionCount = await prisma.kandelVersion.count();
    //         const kandelEventCount = await prisma.kandelEvent.count();
    //         const kandelAdminEventCount = await prisma.kandelAdminEvent.count();

    //         await kandelEventsLogic.handleSetAdmin(false, kandelId, event, tx);

    //         assert.strictEqual( await prisma.kandel.count() - kandelCount, 0 )
    //         assert.strictEqual( await prisma.kandelVersion.count() - kandelVersionCount, 1 )
    //         assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, 1 )
    //         assert.strictEqual( await prisma.kandelAdminEvent.count() - kandelAdminEventCount, 1 )

    //         const newVersion = await prisma.kandelVersion.findUnique({where: { id: new KandelVersionId({kandelId, versionNumber:1}).value}})
    //         assert.deepStrictEqual( newVersion, { ...kandelVersion,
    //         id: newVersion?.id,
    //         adminId: new AccountId(chainId, event.admin).value,
    //         versionNumber: 1,
    //         prevVersionId: kandeVersionId.value 
    //         } )
    //         const kandelEvent = await prisma.kandelEvent.findFirst({where: { kandelVersionId: newVersion.id}}).KandelAdminEvent()
    //         assert.strictEqual( kandelEvent?.admin, event.admin)

    //     })

    //     it("undo Set admin", async () => {
    //         const event: SetAdmin = {
    //             type: "SetAdmin",
    //             admin: "admin"
    //         }
    //         await kandelEventsLogic.handleSetAdmin(false, kandelId, event, tx);


    //         const kandelCount = await prisma.kandel.count();
    //         const kandelVersionCount = await prisma.kandelVersion.count();
    //         const kandelEventCount = await prisma.kandelEvent.count();
    //         const kandelAdminEventCount = await prisma.kandelAdminEvent.count();

    //         await kandelEventsLogic.handleSetAdmin(true, kandelId, event, tx);

    //         assert.strictEqual( await prisma.kandel.count() - kandelCount, 0 )
    //         assert.strictEqual( await prisma.kandelVersion.count() - kandelVersionCount, -1 )
    //         assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, -1 )
    //         assert.strictEqual( await prisma.kandelAdminEvent.count() - kandelAdminEventCount, -1 )
    //     })
    // } )

    // describe( KandelEventsLogic.prototype.handelSetRouter.name, () => {
    //     it("Set router", async () => {
    //         const event: SetRouter = {
    //             type: "SetRouter",
    //             router: "router"
    //         }

    //         const kandelCount = await prisma.kandel.count();
    //         const kandelVersionCount = await prisma.kandelVersion.count();
    //         const kandelEventCount = await prisma.kandelEvent.count();
    //         const kandelRouterEventCount = await prisma.kandelRouterEvent.count();

    //         await kandelEventsLogic.handelSetRouter(false, kandelId, event, tx);

    //         assert.strictEqual( await prisma.kandel.count() - kandelCount, 0 )
    //         assert.strictEqual( await prisma.kandelVersion.count() - kandelVersionCount, 1 )
    //         assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, 1 )
    //         assert.strictEqual( await prisma.kandelRouterEvent.count() - kandelRouterEventCount, 1 )

    //         const newVersion = await prisma.kandelVersion.findUnique({where: { id: new KandelVersionId({kandelId, versionNumber:1}).value}})
    //         assert.deepStrictEqual( newVersion, { ...kandelVersion,
    //         id: newVersion?.id,
    //         routerAddress: event.router,
    //         versionNumber: 1,
    //         prevVersionId: kandeVersionId.value 
    //         } )
    //         const kandelEvent = await prisma.kandelEvent.findFirst({where: { kandelVersionId: newVersion.id}}).KandelRouterEvent()
    //         assert.strictEqual( kandelEvent?.router, event.router)

    //     })

    //     it("undo Set router", async () => {
    //         const event: SetRouter = {
    //             type: "SetRouter",
    //             router: "router"
    //         }
    //         await kandelEventsLogic.handelSetRouter(false, kandelId, event, tx);


    //         const kandelCount = await prisma.kandel.count();
    //         const kandelVersionCount = await prisma.kandelVersion.count();
    //         const kandelEventCount = await prisma.kandelEvent.count();
    //         const kandelRouterEventCount = await prisma.kandelRouterEvent.count();

    //         await kandelEventsLogic.handelSetRouter(true, kandelId, event, tx);

    //         assert.strictEqual( await prisma.kandel.count() - kandelCount, 0 )
    //         assert.strictEqual( await prisma.kandelVersion.count() - kandelVersionCount, -1 )
    //         assert.strictEqual( await prisma.kandelEvent.count() - kandelEventCount, -1 )
    //         assert.strictEqual( await prisma.kandelRouterEvent.count() - kandelRouterEventCount, -1 )
    //     })
    // } )
});