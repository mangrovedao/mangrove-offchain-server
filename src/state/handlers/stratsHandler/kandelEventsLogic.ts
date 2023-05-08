import * as prisma from "@prisma/client";
import BigNumber from "bignumber.js";
import _ from "lodash";
import { AllDbOperations } from "src/state/dbOperations/allDbOperations";

import { kandel } from "@proximaone/stream-schema-mangrove";
import { AccountId, ChainId, KandelId, KandelVersionId, MangroveId, OfferId, TokenBalanceId, TokenId } from "src/state/model";

// import { Credit, Debit, NewKandel, NewAaveKandel, SetParams } from "@proximaone/stream-schema-mangrove/dist/kandel"
import { EventsLogic } from "../eventsLogic";
export class KandelEventsLogic extends EventsLogic {

    db: AllDbOperations;
    constructor(db: AllDbOperations, stream: string) {
        super(stream);
        this.db = db;
    }

    async handleKandelCreated(
        undo: boolean,
        chainId: ChainId,
        event: kandel.NewKandel,
        transaction: prisma.Transaction | undefined) {
        const mangroveId = new MangroveId(chainId, event.mangroveId);
        const kandelId = new KandelId(chainId, event.kandel);
        if (undo) {
            await this.db.kandelOperations.deleteLatestKandelVersion(kandelId);
            await this.db.accountOperations.deleteAccount(kandelId);
            return;
        }
        const reserveId = new AccountId(mangroveId.chainId,  event.reserveId == "" || !event.reserveId ? event.kandel : event.reserveId);
        await this.db.accountOperations.ensureAccount(reserveId);
        const newConfiguration = await this.db.kandelOperations.createNewKandelConfiguration(this.mapSetParamsToKandelConfiguration(event.params));
        const adminId = new AccountId(mangroveId.chainId, event.owner).value;
        const baseToken = new TokenId(mangroveId.chainId, event.base);
        const quoteToken = new TokenId(mangroveId.chainId, event.quote);

        await this.db.kandelOperations.addVersionedKandel({
            id: kandelId,
            txId: transaction!.id,
            updateFunc: (model) => {
                _.merge(model, {
                    adminId: adminId,
                    routerAddress: event.params.router,
                    congigurationId: newConfiguration.id,
                });
            },
            constParams: {
                reserveId: reserveId,
                mangroveId: mangroveId,
                base: baseToken,
                quote: quoteToken,
                type: event.type

            }
        })

    }

    mapSetParamsToKandelConfiguration(setParams: kandel.SetParams):  Omit<prisma.KandelConfiguration, "id"> {
        return {
            compoundRateBase: setParams.compoundRates?.base ?? 0,
            compoundRateQuote: setParams.compoundRates?.quote ?? 0,
            gasPrice: setParams.gasPrice ?? "0",
            gasReq: setParams.gasReq ?? "0",
            ratio: 0,
            spread: 0,
            length: 0
        }
    }

    async handleKandelParamsUpdated(
        undo: boolean,
        kandelId: KandelId,
        event: kandel.SetParams,
        transaction: prisma.Transaction | undefined
    ) {

        if (undo) {
            await this.db.kandelOperations.deleteLatestKandelVersion(kandelId);
            return;
        }
        const currentConfig = await this.db.kandelOperations.getCurrentKandelConfigration(kandelId);
        const kandelConfiguration = this.getKandelConfigWithOverrides(currentConfig, event);
        const newConfiguration = await this.db.kandelOperations.createNewKandelConfiguration(kandelConfiguration);

        const newVersions = await this.db.kandelOperations.addVersionedKandel({
            id: kandelId,
            txId: transaction!.id,
            updateFunc: (model) => {
                _.merge(model, {
                    congigurationId: newConfiguration.id,
                });
            },
        });

        await this.createKandelParamsEvent(kandelId, newVersions.kandelVersion, event, transaction!.id);

    }

    getKandelConfigWithOverrides(currentConfig: Omit< prisma.KandelConfiguration, "id">, overrides: kandel.SetParams): Omit<prisma.KandelConfiguration, "id"> {
        return {
            compoundRateBase: overrides.compoundRates ? overrides.compoundRates.base : currentConfig.compoundRateBase,
            compoundRateQuote: overrides.compoundRates ? overrides.compoundRates.quote : currentConfig.compoundRateQuote,
            gasPrice: overrides.gasPrice ?? currentConfig.gasPrice,
            gasReq: overrides.gasReq ?? currentConfig.gasReq,
            spread: overrides.geometric ? overrides.geometric.spread : currentConfig.spread,
            ratio: overrides.geometric ? overrides.geometric.ratio : currentConfig.ratio,
            length: overrides.length ?? currentConfig.length
        }
    };

    async createKandelParamsEvent(kandelId: KandelId, kandelVersion: prisma.KandelVersion | KandelVersionId, event: kandel.SetParams, txId: string) {
        const kandelEvent = await this.db.kandelOperations.createKandelEvent(kandelId, txId, kandelVersion);
        if (event.gasReq) {
            return await this.db.kandelOperations.createKandelGasReqEvent(kandelEvent, event.gasReq);
        } else if (event.gasPrice) {
            return await this.db.kandelOperations.createKandelGasPriceEvent(kandelEvent, event.gasPrice);
        } else if (event.length) {
            return await this.db.kandelOperations.createKandelLengthEvent(kandelEvent, event.length);
        } else if (event.compoundRates) {
            return await this.db.kandelOperations.createKandelCompoundRateEvent(kandelEvent, event.compoundRates.base, event.compoundRates.quote);
        } else if (event.geometric) {
            return await this.db.kandelOperations.createKandelGeometricParamsEvent(kandelEvent, event.geometric.ratio, event.geometric.spread);
        } else if (event.router) {
            return await this.db.kandelOperations.createKandelRouterEvent(kandelEvent, event.router);
        } else if (event.admin) {
            return await this.db.kandelOperations.createKandelAdminEvent(kandelEvent, event.admin);
        }
        throw new Error(`Could not find correct kandel event: ${ JSON.stringify( event )}`);
    }

    async handleDepositWithdrawal(
        undo: boolean,
        kandelId: KandelId,
        event: kandel.Debit | kandel.Credit,
        transaction: prisma.Transaction | undefined) {

        const reserveAddress = await this.db.kandelOperations.getReserveAddress({ kandelId });
        const reserveId = new AccountId(kandelId.chainId, reserveAddress);
        const tokenId = new TokenId(kandelId.chainId, event.token);
        const tokenBalanceId = new TokenBalanceId({ accountId: reserveId, tokenId: tokenId, stream: this.stream });

        if (undo) {
            await this.db.tokenBalanceOperations.deleteLatestTokenBalanceVersion(tokenBalanceId)
            return;
        }

        const tokenBalance = await this.db.tokenBalanceOperations.getCurrentTokenBalanceVersion(tokenBalanceId);
        const newDepositWithdrawalAmount = event.type == "Credit" ? new BigNumber(tokenBalance.deposit) : new BigNumber(tokenBalance.withdrawal)
        const newAmount = new BigNumber(newDepositWithdrawalAmount).plus(new BigNumber(event.amount)).toString()
        const plusMinus = event.type == "Debit" ? "minus" : "plus";

        const {  newVersion: newTokenBalanceVersion } = await this.db.tokenBalanceOperations.addTokenBalanceVersion({
            tokenBalanceId: tokenBalanceId,
            txId: transaction!.id,
            updateFunc: (model) => {
                _.merge(model, {
                    withdrawal: event.type == "Debit" ? newAmount : tokenBalance.withdrawal,
                    deposit: event.type == "Credit" ? newAmount : tokenBalance.deposit,
                    balance: new BigNumber(tokenBalance.balance)[plusMinus](new BigNumber(event.amount)).toString()

                })
            }
        })

        const tokenBalanceEvent = await this.db.tokenBalanceOperations.createTokenBalanceEvent(reserveId, tokenId, newTokenBalanceVersion);
        if (event.type == "Credit") {
            await this.db.tokenBalanceOperations.createTokenBalanceDepositEvent(tokenBalanceEvent, event.amount, kandelId.value);
        } else {
            await this.db.tokenBalanceOperations.createTokenBalanceWithdrawalEvent(tokenBalanceEvent, event.amount, kandelId.value);
        }
    }

    async handelRetractOffers(
        undo: boolean,
        kandelId: KandelId,
        event: kandel.Retract,
        transaction: prisma.Transaction | undefined
    ) {
        const kandel = await this.db.kandelOperations.getKandel(kandelId);
        const mangroveId = new MangroveId(kandelId.chainId, kandel.mangroveId);
        if (undo) {
            await this.db.kandelOperations.deleteAllKandelEventsForTransaction(kandelId, transaction!.id)
            return;
        }

        const kandelEvent = await this.db.kandelOperations.createKandelEvent(kandelId, transaction!.id );
        const kandelRetractEvent = await this.db.kandelOperations.createKandelRetractEvent(kandelEvent);

        for( const offerRetracted of event.offers) {
            const offerId = new OfferId(mangroveId, offerRetracted.offerList, offerRetracted.offerId);
            await this.db.kandelOperations.createKandelUpdateOffer( kandelRetractEvent, offerId,"0" )
        }
    }

    async handlePopulate(
        undo: boolean,
        kandelId: KandelId,
        event: kandel.Populate,
        transaction: prisma.Transaction | undefined
    ) {
        const kandel = await this.db.kandelOperations.getKandel(kandelId);
        const mangroveId = new MangroveId(kandelId.chainId, kandel.mangroveId);
        if (undo) {
            // Delete of offerIndex is handled when the offer is deleted, because of onDetele: cascade in the schema
            await this.db.kandelOperations.deleteAllKandelEventsForTransaction(kandelId, transaction!.id)
            return;
        }

        await this.handlePopulateOfferWrittenEvents(kandelId, event, mangroveId, transaction);
        await this.handlePopulateOfferIndexes(kandelId, event, mangroveId, transaction);
    }

    async handlePopulateOfferWrittenEvents(kandelId: KandelId, event: kandel.Populate, mangroveId: MangroveId, transaction: prisma.Transaction | undefined) {
        const kandelEvent = await this.db.kandelOperations.createKandelEvent(kandelId, transaction!.id );
         
        const kandelPopulateEvent = await this.db.kandelOperations.createKandelPopulateEvent(kandelEvent);

        for (const offerWritten of event.offers) {
            const offerId = new OfferId(mangroveId, offerWritten.offerList, offerWritten.offer.id);
            await this.db.kandelOperations.createKandelUpdateOffer( kandelPopulateEvent, offerId, offerWritten.offer.gives)
        }
    }

    async handlePopulateOfferIndexes(kandelId: KandelId, event: kandel.Populate, mangroveId: MangroveId, transaction: prisma.Transaction | undefined) {
        const base = await this.db.kandelOperations.getToken(kandelId, "baseId");
        const quote = await this.db.kandelOperations.getToken(kandelId, "quoteId");

        for (const offerIndex of event.indexMapping) {
            const offerId = new OfferId(mangroveId, {
                outboundToken: offerIndex.ba === 1 ? base.address : quote.address,
                inboundToken: offerIndex.ba === 1 ? quote.address : base.address,
            }, offerIndex.offerId);
            await this.db.kandelOperations.createOfferIndex(kandelId, transaction!.id, offerId, offerIndex.index, offerIndex.ba === 1 ? "ask" : "bid");
        }
    }

    async handleOfferIndex(
        undo: boolean,
        kandelId: KandelId,
        event: kandel.SetIndexMapping,
        transaction: prisma.Transaction | undefined
    ) {
        const kandel = await this.db.kandelOperations.getKandel(kandelId);
        const base = await this.db.kandelOperations.getToken(kandelId, "baseId");
        const quote = await this.db.kandelOperations.getToken(kandelId, "quoteId");
        const offerId = new OfferId(new MangroveId(kandelId.chainId, kandel.mangroveId), {
            outboundToken: event.ba === 1 ? base.address : quote.address,
            inboundToken: event.ba === 1 ? quote.address : base.address,
        }, event.offerId);

        if (undo) {
            await this.db.kandelOperations.deleteOfferIndex(kandelId, offerId, event.ba === 1 ? "ask" : "bid");
            return;
        }
        await this.db.kandelOperations.createOfferIndex(kandelId, transaction!.id, offerId, event.index, event.ba === 1 ? "ask" : "bid");
    }

    // async handleSetAdmin(
    //     undo: boolean,
    //     kandelId: KandelId,
    //     event: kandel.SetAdmin,
    //     transaction: prisma.Transaction | undefined
    // ) {

    //     if (undo) {
    //         await this.db.kandelOperations.deleteLatestKandelVersion(kandelId);
    //         return;
    //     }
    //     const adminId = new AccountId(kandelId.chainId, event.admin);
    //     await this.db.accountOperations.ensureAccount(adminId);

    //     const newVersions = await this.db.kandelOperations.addVersionedKandel({
    //         id: kandelId,
    //         txId: transaction!.id,
    //         updateFunc: (model) => {
    //             _.merge(model, {
    //                 adminId: adminId.value,
    //             });
    //         },
    //     })

    //     const kandelEvent = await this.db.kandelOperations.createKandelEvent(kandelId, transaction!.id, newVersions.kandelVersion);
    //     await this.db.kandelOperations.createKandelAdminEvent(kandelEvent, event.admin);
    // }

    // async handelSetRouter(
    //     undo: boolean,
    //     kandelId: KandelId,
    //     event: SetRouter,
    //     transaction: prisma.Transaction | undefined
    // ) {

    //     if (undo) {
    //         await this.db.kandelOperations.deleteLatestKandelVersion(kandelId);
    //         return;
    //     }

    //     const newVersions = await this.db.kandelOperations.addVersionedKandel({
    //         id: kandelId,
    //         txId: transaction!.id,
    //         updateFunc: (model) => {
    //             _.merge(model, {
    //                 routerAddress: event.router,
    //             });
    //         },
    //     })

    //     const kandelEvent = await this.db.kandelOperations.createKandelEvent(kandelId, transaction!.id, newVersions.kandelVersion);
    //     await this.db.kandelOperations.createKandelRouterEvent(kandelEvent, event.router);

    // }




}


