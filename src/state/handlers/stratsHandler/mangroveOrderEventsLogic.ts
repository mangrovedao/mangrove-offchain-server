import { Transaction, MangroveOrderVersion, TakenOffer, Token, MangroveOrder } from ".prisma/client";
import { PrismaClient } from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { OrderSummary } from "@proximaone/stream-schema-mangrove/dist/strategyEvents";
import { Timestamp } from "@proximaone/stream-client-js";
import { AllDbOperations } from "../../../state/dbOperations/allDbOperations";
import { addNumberStrings, getNumber, getPrice } from "../../../state/handlers/handlerUtils";
import {
  AccountId,
  ChainId,
  MangroveId,
  MangroveOrderId,
  MangroveOrderVersionId,
  OfferId,
  OfferListId,
  StratId,
  TokenId,
} from "../../model";
import { MangroveOrderIds, MangroveOrderOperations } from "../../../state/dbOperations/mangroveOrderOperations";
import { mangrove } from "@proximaone/stream-schema-mangrove/dist/streams";



export class MangroveOrderEventsLogic {


  async handleSetExpiry(
    db: AllDbOperations,
    chainId: ChainId,
    txId: string,
    params: {
      mangroveId: string;
      offerId: number;
      expiry: Timestamp;
      outboundToken: string;
      inboundToken: string;
    }
  ) {
    const offerListKey = {
      inboundToken: params.inboundToken,
      outboundToken: params.outboundToken,
    };
    const mangroveId = new MangroveId(chainId, params.mangroveId);
    const offerId = new OfferId( mangroveId, offerListKey, params.offerId );

    db.mangroveOrderOperations.addMangroveOrderVersionFromOfferId(
      offerId,
      txId,
      (m) => (m.expiryDate = new Date(params.expiry.epochMs))
    );
  }

  async handleOrderSummary(
    db: AllDbOperations,
    chainId: ChainId,
    e: OrderSummary & { id: string; address: string },
    event: any,
    txHash: string,
    undo: boolean,
    transaction: Transaction
  ) {
    const offerList = {
      outboundToken: e.outboundToken,
      inboundToken: e.inboundToken,
    };
    await db.tokenOperations.assertTokenExists(
      new TokenId(chainId, offerList.outboundToken)
    );
    await db.tokenOperations.assertTokenExists(
      new TokenId(chainId, offerList.inboundToken)
    );
    const mangroveId = new MangroveId(chainId, e.mangroveId);
    const offerListId = new OfferListId(mangroveId, offerList);
    const mangroveOrderId = new MangroveOrderId(
      mangroveId,
      offerList,
      e.id,
    );

    if (undo) {
      await db.mangroveOrderOperations.deleteMangroveOrder(mangroveOrderId);
      return;
    }
    const restingOrderId = new OfferId(mangroveId, offerList, e.restingOrderId);

    const { outboundToken, inboundToken } = await db.offerListOperations.getOfferListTokens({
      id:offerListId
  });
    const takerGaveNumber = getNumber({
      value: e.takerGave,
      token: inboundToken,
    });
    const takerGotNumber = getNumber({
      value: e.takerGot,
      token: outboundToken,
    });

    let initialVersionFunc = (version: Omit<MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">) => {
      version.filled = this.getFilled(e, outboundToken);
      version.cancelled = false;
      version.failed = false;
      version.failedReason = null;
      version.takerGot = e.takerGot;
      version.takerGotNumber = takerGotNumber;
      version.takerGave = e.takerGave;
      version.takerGaveNumber = takerGaveNumber;
      version.price = getPrice({ over: takerGaveNumber, under: takerGotNumber }) ?? 0;
      version.expiryDate = new Date(e.expiryDate);
    }


    let initialMangroveOrderValue = {
      takerId: new AccountId(chainId, e.taker).value,
      stratId: new StratId(chainId, e.address).value,
      fillOrKill: e.fillOrKill.valueOf(),
      fillWants: e.fillWants.valueOf(),
      restingOrder: e.restingOrder.valueOf(),
      takerWants: e.takerWants,
      takerWantsNumber: getNumber({
        value: e.takerWants,
        token: outboundToken,
      }),
      takerGives: e.takerGives,
      takerGivesNumber: getNumber({
        value: e.takerGives,
        token: inboundToken,
      }),
      bounty: e.bounty,
      bountyNumber: getNumber({ value: e.bounty, decimals: 18 }),
      totalFee: e.fee,
      totalFeeNumber: getNumber({ value: e.fee, token: outboundToken }),
      restingOrderId: restingOrderId.value,
    }

    await db.mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId, transaction.id, initialVersionFunc, initialMangroveOrderValue);

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
    newVersion.takerGaveNumber = getNumber({
      value: newVersion.takerGave,
      token: tokens.inboundToken,
    });
    newVersion.takerGot = addNumberStrings({
      value1: newVersion.takerGot,
      value2: takenOffer.takerGot,
      token: tokens.outboundToken,
    });
    newVersion.takerGotNumber = getNumber({
      value: newVersion.takerGot,
      token: tokens.inboundToken,
    });
    newVersion.filled = this.getFilled({ ...mangroveOrder, ...newVersion, fee: mangroveOrder.totalFee}, tokens.outboundToken);
    newVersion.price = getPrice({
      over: newVersion.takerGaveNumber,
      under: newVersion.takerGotNumber
    }
    ) ?? 0;

  }

  getFilled(event: {fillWants: boolean, takerWants: string, takerGives: string, fee: string, takerGave: string, takerGot: string }, outboundToken: { decimals: number }) {
    return event.fillWants
      ? event.takerWants ==
      addNumberStrings({
        value1: event.takerGot,
        value2: event.fee,
        token: outboundToken,
      })
      : event.takerGave == event.takerGives;
  }

  getFailedReason(
    o: {failReason: string| null, posthookData:string |null}
  ): string | null {
    return o.failReason ? o.failReason : o.posthookData;
  }

  getFailed(o: {posthookFailed: boolean, posthookData:string |null}): boolean {
    return o.posthookFailed || o.posthookData != null;
  }
}
