import { Transaction, MangroveOrderVersion,TakenOffer, Token, MangroveOrder } from ".prisma/client";
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
    txId: string,
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
      txId,
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

    const { outboundToken, inboundToken } = await this.getOutboundInbound(
      offerListId,
      db,
      txHash,
      event
    );
    const takerGaveNumber = getNumber({
      value: e.takerGave,
      token: inboundToken,
    });
    const takerGotNumber = getNumber({
      value: e.takerGot,
      token: outboundToken,
    });

    let initialVersionFunc = (version:Omit< MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId" >) => {
    version.filled= this.getFilled(e, outboundToken);
    version.cancelled= false;
    version.failed= false;
    version.failedReason= null;
    version.takerGot= e.takerGot;
    version.takerGotNumber= takerGotNumber;
    version.takerGave= e.takerGave;
    version.takerGaveNumber= takerGaveNumber;
    version.price= getPrice({ over: takerGaveNumber, under: takerGotNumber}) ?? 0;
    version.expiryDate= new Date( e.expiryDate );
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

    await db.mangroveOrderOperations.addMangroveOrderVersion( mangroveOrderId, transaction.id, initialVersionFunc, initialMangroveOrderValue ); 

  }

  public async updateMangroveOrderFromTakenOffer(
    takenOffer: Omit<TakenOffer, "orderId" | "offerVersionId">,
    tokens: {
      outboundToken: { decimals: number},
      inboundToken: { decimals: number},
  },
  mangroveOrder: {fillWants: boolean, takerWants: string, takerGives: string, totalFee: string},
    newVersion:Omit< MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId" > 
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
      newVersion.filled = this.getFilled( { fillWants: mangroveOrder.fillWants, takerWants: mangroveOrder.takerWants, takerGives: mangroveOrder.takerGives, takerGot: newVersion.takerGot, takerGave: newVersion.takerGave, fee: mangroveOrder.totalFee}, tokens.outboundToken );
      newVersion.price = getPrice({ 
        over: newVersion.takerGaveNumber,
        under: newVersion.takerGotNumber }
      ) ?? 0;
    
  }

 getFilled(e: { fillWants: boolean, takerWants: string, takerGives: string, fee: string, takerGave: string, takerGot: string}, outboundToken: {decimals: number}) {
    return e.fillWants
      ? e.takerWants ==
      addNumberStrings({
        value1: e.takerGot,
        value2: e.fee,
        token: outboundToken,
      })
      : e.takerGave == e.takerGives;
  }

  getFailedReason(
    o: Omit<TakenOffer, "orderId" | "offerVersionId">
    ): string | null {
      return o.failReason ? o.failReason : o.posthookData;
    }
    
    getFailed(o: Omit<TakenOffer, "orderId" | "offerVersionId">): boolean {
      return o.posthookFailed || o.posthookData != null;
    }
}
