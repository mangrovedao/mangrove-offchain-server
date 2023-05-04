import { MangroveOrderVersion, TakenOffer, Transaction } from ".prisma/client";
import { OrderSummary } from "@proximaone/stream-schema-mangrove/dist/strategyEvents";
import { AllDbOperations } from "src/state/dbOperations/allDbOperations";
import { addNumberStrings, fromBigNumber, getPrice } from "src/utils/numberUtils";
import {
  AccountId,
  ChainId,
  MangroveId,
  MangroveOrderId,
  OfferId,
  OfferListingId,
  OrderId,
  TokenId
} from "src/state/model";
import logger from "src/utils/logger";



export class MangroveOrderEventsLogic {


  async handleSetExpiry(
    db: AllDbOperations,
    chainId: ChainId,
    txId: string,
    params: {
      address: string;
      offerId: number;
      date: number;
      outboundToken: string;
      inboundToken: string;
    }
  ) {

    const stratId = new AccountId(chainId, params.address);
    const mangroveId = await db.mangroveOrderOperations.getMangroveIdByStratId(stratId);
    if (!mangroveId) {
      logger.info(`MangroveOrder strat not yet created, address: ${stratId.value}`)
      return;
    }
    const offerListKey = {
      inboundToken: params.inboundToken,
      outboundToken: params.outboundToken,
    };
    const offerId = new OfferId(mangroveId, offerListKey, params.offerId);

    await db.mangroveOrderOperations.addMangroveOrderVersionFromOfferId(
      offerId,
      txId,
      (m) => (m.expiryDate = new Date(params.date))
    );
  }

  async handleOrderSummary(
    db: AllDbOperations,
    chainId: ChainId,
    e: OrderSummary & { id: string; address: string },
    undo: boolean,
    transaction: Transaction
  ) {
    const offerList = this.getOfferListFromOrderSummary(e);
    await db.tokenOperations.assertTokenExists(
      new TokenId(chainId, offerList.outboundToken)
    );
    await db.tokenOperations.assertTokenExists(
      new TokenId(chainId, offerList.inboundToken)
    );
    const mangroveId = new MangroveId(chainId, e.mangroveId);
    const offerListingId = new OfferListingId(mangroveId, offerList);
    const mangroveOrderId = new MangroveOrderId(
      mangroveId,
      offerList,
      e.id,
    );

    if (undo) {
      await db.mangroveOrderOperations.deleteLatestVersionOfMangroveOrder(mangroveOrderId);
      return;
    }

    const { outboundToken, inboundToken } = await db.offerListOperations.getOfferListTokens({
      id: offerListingId
    });
    const takerGaveNumber = fromBigNumber({
      value: e.takerGave,
      token: inboundToken,
    });
    const takerGotNumber = fromBigNumber({
      value: e.takerGot,
      token: outboundToken,
    });

    const initialVersionFunc = (version: Omit<MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">) => {
      version.filled = this.getFilled(e, outboundToken);
      version.cancelled = false;
      version.failed = false;
      version.failedReason = null;
      version.takerGot = e.takerGot;
      version.takerGotNumber = takerGotNumber;
      version.takerGave = e.takerGave;
      version.takerGaveNumber = takerGaveNumber;
      version.price = getPrice({ over: e.fillWants.valueOf() ? takerGaveNumber : takerGotNumber, under: e.fillWants.valueOf() ? takerGotNumber : takerGaveNumber }) ?? 0;
      version.expiryDate = new Date(e.expiryDate * 1000);
    }



    await db.mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId, transaction.id, initialVersionFunc, {
      orderId: new OrderId(mangroveId, offerList, e.orderId).value,
      takerId: new AccountId(chainId, e.taker).value,
      stratId: new AccountId(chainId, e.address).value,
      fillOrKill: e.fillOrKill.valueOf(),
      fillWants: e.fillWants.valueOf(),
      restingOrder: e.restingOrder.valueOf(),
      takerWants: e.takerWants,
      takerWantsNumber: fromBigNumber({
        value: e.takerWants,
        token: outboundToken,
      }),
      takerGives: e.takerGives,
      takerGivesNumber: fromBigNumber({
        value: e.takerGives,
        token: inboundToken,
      }),
      bounty: e.bounty,
      bountyNumber: fromBigNumber({ value: e.bounty, decimals: 18 }),
      totalFee: e.fee,
      totalFeeNumber: fromBigNumber({ value: e.fee, token: outboundToken }),
      restingOrderId: e.restingOrderId != 0 ? new OfferId(mangroveId, {outboundToken:offerList.inboundToken, inboundToken: offerList.outboundToken}, e.restingOrderId).value : null,
    });

  }



  async newVersionOfMangroveOrderFromTakenOffer(
    takenOffer: Omit<TakenOffer, "orderId" | "offerVersionId">,
    tokens: {
      outboundToken: { decimals: number },
      inboundToken: { decimals: number },
    },
    mangroveOrder: { fillWants: boolean, takerWants: string, takerGives: string, totalFee: string },
    newVersion: Omit<MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">
  ) {

    newVersion.failed = this.getFailed(takenOffer);
    newVersion.failedReason = this.getFailedReason(takenOffer);
    newVersion.takerGave = addNumberStrings({
      value1: newVersion.takerGave,
      value2: takenOffer.takerGave,
      token: tokens.inboundToken,
    });
    newVersion.takerGaveNumber = fromBigNumber({
      value: newVersion.takerGave,
      token: tokens.inboundToken,
    });
    newVersion.takerGot = addNumberStrings({
      value1: newVersion.takerGot,
      value2: takenOffer.takerGot,
      token: tokens.outboundToken,
    });
    newVersion.takerGotNumber = fromBigNumber({
      value: newVersion.takerGot,
      token: tokens.inboundToken,
    });
    newVersion.filled = this.getFilled({ ...mangroveOrder, ...newVersion, fee: mangroveOrder.totalFee }, tokens.outboundToken);
    newVersion.price = getPrice({
      over: mangroveOrder.fillWants ? newVersion.takerGaveNumber : newVersion.takerGotNumber,
      under: mangroveOrder.fillWants ? newVersion.takerGotNumber : newVersion.takerGaveNumber
    }
    ) ?? 0;
  }

  getFilled(event: { fillWants: boolean, takerWants: string, takerGives: string, fee: string, takerGave: string, takerGot: string }, outboundToken: { decimals: number }) {
    return event.fillWants
      ? event.takerWants ==
      addNumberStrings({
        value1: event.takerGot,
        value2: event.fee,
        token: outboundToken,
      })
      : event.takerGave == event.takerGives;
  }
  getOfferListFromOrderSummary(e:{ fillWants: boolean, outboundToken: string, inboundToken: string }) {
    return {
      outboundToken: e.outboundToken,
      inboundToken: e.inboundToken,
    };
  }

  getFailedReason(
    o: { failReason: string | null, posthookData: string | null }
  ): string | null {
    return o.failReason ? o.failReason : o.posthookData;
  }

  getFailed(o: { posthookFailed: boolean, posthookData: string | null }): boolean {
    return o.posthookFailed || o.posthookData != null;
  }
}
