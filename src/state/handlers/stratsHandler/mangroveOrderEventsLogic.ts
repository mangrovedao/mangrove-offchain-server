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
import { MangroveOrderIds, MangroveOrderOperations } from "../../../state/dbOperations/mangroveOrderOperations";



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

    await db.mangroveOrderOperations.createNewMangroveOrderAndVersion( e, inboundToken, outboundToken, mangroveOrderId, transaction, mangroveId, chainId, offerListId, restingOrderId);
  }





}
