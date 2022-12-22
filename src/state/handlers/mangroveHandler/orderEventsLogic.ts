import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import { AllDbOperations } from "state/dbOperations/allDbOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListId,
  OrderId,
  TakenOfferId
} from "../../model";
import { getBigNumber, getNumber, getPrice } from "../handlerUtils";

export class OrderEventLogic {
  async handleOrderCompleted(
    txRef: any,
    order: mangroveSchema.core.Order,
    offerList: mangroveSchema.core.OfferList,
    id: string,
    undo: boolean,
    mangroveId: MangroveId,
    chainId: ChainId,
    transaction: prisma.Transaction | undefined,
    db: AllDbOperations,
    parentOrderId: OrderId | undefined,
  ) {
    assert(txRef);
    const orderId = new OrderId(mangroveId, offerList, id);

    if (undo) {
      await db.orderOperations.undoOrder(mangroveId, offerList, orderId, order);
      
      return;
    }

    await this.createOrder(mangroveId, offerList, order, chainId, orderId, transaction!.id, db, parentOrderId);
  }

  async createOrder(
    mangroveId: MangroveId, 
    offerList: mangroveSchema.core.OfferList, 
    order: mangroveSchema.core.Order, 
    chainId: ChainId, 
    orderId: OrderId, 
    txId: string, 
    db: AllDbOperations,
    parentOrderId?: OrderId,
  ){
    const offerListId = new OfferListId(mangroveId, offerList);
  
    const { outboundToken, inboundToken } = await db.offerListOperations.getOfferListTokens({
      id: offerListId,
    });
    const takerGotBigNumber = getBigNumber({
      value: order.takerGot,
      token: outboundToken,
    });
    const takerGaveBigNumber = getBigNumber({
      value: order.takerGave,
      token: inboundToken,
    });
    const takerAccountId = new AccountId(chainId, order.taker);
    await db.accountOperations.ensureAccount(takerAccountId);
    const prismaOrder:prisma.Order ={
      id: orderId.value,
      txId: txId,
      proximaId: orderId.proximaId,
      parentOrderId: parentOrderId?.value ?? null,
      offerListId: offerListId.value,
      mangroveId: mangroveId.value,
      takerId: takerAccountId.value,
      // takerWants: order.takerWants,
      // takerWantsNumber: getNumber({
      //   value: order.takerWants,
      //   token: outboundToken,
      // }),
      // takerGives: order.takerGives,
      // takerGivesNumber: getNumber({
      //   value: order.takerGives,
      //   token: inboundToken,
      // }),
      takerGot: order.takerGot,
      takerGotNumber: takerGotBigNumber.toNumber(),
      takerGave: order.takerGave,
      takerGaveNumber: takerGaveBigNumber.toNumber(),
      takerPaidPrice: getPrice({ over: takerGaveBigNumber, under: takerGotBigNumber }),
      makerPaidPrice: getPrice({ over: takerGotBigNumber, under: takerGaveBigNumber }),
      bounty: order.penalty,
      bountyNumber: getNumber({ value: order.penalty, decimals: 18 }),
      // totalFee: order.feePaid,
      // totalFeeNumber: getNumber({
      //   value: order.feePaid,
      //   token: outboundToken,
      // }),
    }
    const takenOffers:Omit<prisma.TakenOffer, "orderId">[] = await Promise.all( order.takenOffers.map( (value) => this.mapTakenOffer( orderId, value, inboundToken, outboundToken, db)) );

    await db.orderOperations.createOrder( orderId, prismaOrder, takenOffers );
  }

  public async mapTakenOffer(
    orderId: OrderId,
    takenOfferEvent: mangroveSchema.core.TakenOffer,
    inboundToken: {decimals: number},
    outboundToken: {decimals: number},
    db:AllDbOperations,
  ) {
    const takerGotBigNumber = getBigNumber({ value: takenOfferEvent.takerWants, token: outboundToken} );
    const takerGaveBigNumber = getBigNumber({ value: takenOfferEvent.takerGives, token: inboundToken} );
    const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOfferEvent.id);
    const offer = await db.offerOperations.getOffer(offerId);

    assert(offer);

    const takenOffer:Omit<prisma.TakenOffer, "orderId"> = {
      id: new TakenOfferId(orderId, takenOfferEvent.id).value,
      offerVersionId: offer.currentVersionId,
      takerGot: takenOfferEvent.takerWants,
      takerGotNumber: takerGotBigNumber.toNumber(),
      takerGave: takenOfferEvent.takerGives,
      takerGaveNumber: takerGaveBigNumber.toNumber(),
      takerPaidPrice: getPrice({ over: takerGaveBigNumber, under: takerGotBigNumber}),
      makerPaidPrice: getPrice({ over: takerGotBigNumber, under: takerGaveBigNumber}),
      failReason: takenOfferEvent.failReason ?? null,
      posthookData: takenOfferEvent.posthookData ?? null ,
      posthookFailed: takenOfferEvent.posthookFailed ?? false,
    };

    // Taken offers have been removed from the book. Any offers that are reposted
    // will result in `OfferWritten` events that will be sent _after_ the
    // `OrderCompleted` event. We therefore remove all taken offers here.

    return takenOffer;
  }

  


}
