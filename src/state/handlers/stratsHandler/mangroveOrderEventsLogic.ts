import { Transaction } from ".prisma/client";
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

type MangroveOrderIds = {
  mangroveOrderId: string;
  txId: string;
  mangroveId: string;
  stratId: string;
  offerListId: string;
  takerId: string;
  // orderId: string;
  currentVersionId: string;
};

export class MangroveOrderEventsLogic {
  async getOutboundInbound(
    offerListId: OfferListId,
    db: AllDbOperations,
    txHash: string,
    event: any
  ) {
    let outboundToken, inboundToken;
    try {
      const tokens = await db.offerListOperations.getOfferListTokens({
        id: offerListId,
      });
      outboundToken = tokens.outboundToken;
      inboundToken = tokens.inboundToken;
    } catch (e) {
      console.log(`failed to get offer list tokens - tx=${txHash}`, event);
      throw e;
    }
    return { outboundToken, inboundToken };
  }


  async handleSetExpiry(
    db: AllDbOperations,
    chainId: ChainId,
    params: {
      mangroveId: string;
      offerId: number;
      expiry: Timestamp;
      outboundToken: string;
      inboundToken: string;
    }
  ) {
    const offerId = new OfferId(
      new MangroveId(chainId, params.mangroveId),
      {
        inboundToken: params.inboundToken,
        outboundToken: params.outboundToken,
      },
      params.offerId
    );

    db.mangroveOrderOperations.addMangroveOrderVersionFromOfferId(
      offerId,
      (m) => (m.expiryDate = new Date( params.expiry.epochMs ))
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
    const mangroveOrderId = new MangroveOrderId({
      mangroveId: mangroveId,
      offerListKey: offerList,
      mangroveOrderId: e.id,
    });

    if (undo) {
      await db.mangroveOrderOperations.deleteMangroveOrder(mangroveOrderId);
      return;
    }
    const restingOrderId = new OfferId(mangroveId, offerList, e.restingOrderId);

    const { outboundToken, inboundToken } = await this.getOutboundInbound(
      offerListId,
      db,
      txHash,
      event
    );

    const mangroveOrderVersion = await this.createMangroveOrderVersion(
      e,
      inboundToken,
      outboundToken,
      mangroveOrderId,
      db
    );

    const mangroveOrderIds: MangroveOrderIds = {
      mangroveOrderId: mangroveOrderId.value,
      txId: transaction.id,
      mangroveId: mangroveId.value,
      stratId: new StratId(chainId, e.address).value,
      offerListId: offerListId.value,
      takerId: new AccountId(chainId, e.taker).value,
      // orderId: e.orderId,
      currentVersionId: mangroveOrderVersion.id,
    };

    await this.createMangroveOrder(
      db,
      mangroveOrderIds,
      e,
      outboundToken,
      inboundToken,
      restingOrderId
    );
  }

  async createMangroveOrder(
    db: AllDbOperations,
    mangroveOrderIds: MangroveOrderIds,
    e: mangroveSchema.strategyEvents.OrderSummary,
    outboundToken: { decimals: number },
    inboundToken: { decimals: number },
    restingOrderId: OfferId
  ) {
    await db.mangroveOrderOperations.createMangroveOrder({
      id: mangroveOrderIds.mangroveOrderId,
      txId: mangroveOrderIds.txId,
      mangroveId: mangroveOrderIds.mangroveId,
      stratId: mangroveOrderIds.stratId,
      offerListId: mangroveOrderIds.offerListId,
      takerId: mangroveOrderIds.takerId,
      // orderId: mangroveOrderIds.orderId,
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
      currentVersionId: mangroveOrderIds.currentVersionId,
    });
  }

  async createMangroveOrderVersion(
    e: mangroveSchema.strategyEvents.OrderSummary,
    inboundToken: { decimals: number },
    outboundToken: { decimals: number },
    mangroveOrderId: MangroveOrderId,
    db: AllDbOperations
  ) {
    const takerGaveNumber = getNumber({
      value: e.takerGave,
      token: inboundToken,
    });
    const takerGotNumber = getNumber({
      value: e.takerGot,
      token: outboundToken,
    });
    const mangroveOrderVersionId = new MangroveOrderVersionId({
      mangroveOrderId: mangroveOrderId,
      versionNumber: 0,
    });

    return await db.mangroveOrderOperations.createMangroveOrderVersion({
      id: mangroveOrderVersionId.value,
      mangroveOrderId: mangroveOrderId.value,
      filled: e.fillWants
        ? e.takerWants ==
          addNumberStrings({
            value1: e.takerGot,
            value2: e.fee,
            token: outboundToken,
          })
        : e.takerGave == e.takerGives,
      cancelled: false,
      failed: false,
      failedReason: null,
      takerGot: e.takerGot,
      takerGotNumber: takerGotNumber,
      takerGave: e.takerGave,
      takerGaveNumber: takerGaveNumber,
      price: getPrice({ over: takerGaveNumber, under: takerGotNumber}) ?? 0,
      expiryDate: new Date( e.expiryDate ),
      versionNumber: 0,
      prevVersionId: null,
    });
  }
}
