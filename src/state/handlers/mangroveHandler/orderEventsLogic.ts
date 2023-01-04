import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListingId,
  OrderId,
  TakenOfferId
} from "src/state/model";
import { getBigNumber, getNumber, getPrice } from "src/state/handlers/handlerUtils";
import { AllDbOperations } from "src/state/dbOperations/allDbOperations";

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
    const takerAccountId = new AccountId(chainId, order.taker);
    await db.accountOperations.ensureAccount(takerAccountId);

    const offerListId = new OfferListingId(mangroveId, offerList);

    const tokens = await db.offerListOperations.getOfferListTokens({
      id: offerListId,
    });
    const prismaOrder = this.createOrder(mangroveId, offerListId, tokens, order, takerAccountId, orderId, transaction!.id, parentOrderId);
    const takenOffers: Omit<prisma.TakenOffer, "orderId">[] = await Promise.all(order.takenOffers.map((value) => this.mapTakenOffer(orderId, value, tokens, (o) => db.offerOperations.getOffer(o))));

    await db.orderOperations.createOrder(orderId, prismaOrder, takenOffers);
  }

  createOrder(
    mangroveId: MangroveId,
    offerListId: OfferListingId,
    tokens: { inboundToken: { decimals: number }, outboundToken: { decimals: number } },
    order: Omit<mangroveSchema.core.Order, "takenOffers" | "taker">,
    takerId: AccountId,
    orderId: OrderId,
    txId: string,
    parentOrderId?: OrderId,
  ) {

    const takerGotBigNumber = getBigNumber({
      value: order.takerGot,
      token: tokens.outboundToken,
    });
    const takerGaveBigNumber = getBigNumber({
      value: order.takerGave,
      token: tokens.inboundToken,
    });

    const prismaOrder: prisma.Order = {
      id: orderId.value,
      txId: txId,
      proximaId: orderId.proximaId,
      parentOrderId: parentOrderId?.value ?? null,
      offerListingId: offerListId.value,
      mangroveId: mangroveId.value,
      takerId: takerId.value,
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
      totalFee: order.feePaid.length == 0 ? "0" : order.feePaid,
      totalFeeNumber: order.feePaid.length == 0 ? 0 : getNumber({
        value: order.feePaid,
        token: tokens.outboundToken,
      }),
    }

    return prismaOrder;
  }

  public async mapTakenOffer(
    orderId: OrderId,
    takenOfferEvent: mangroveSchema.core.TakenOffer,
    tokens: { inboundToken: { decimals: number }, outboundToken: { decimals: number } },
    getOffer: (offerId: OfferId) => Promise< { currentVersionId:string }| null>,
  ) {
    const takerGotBigNumber = getBigNumber({ value: takenOfferEvent.takerWants, token: tokens.outboundToken });
    const takerGaveBigNumber = getBigNumber({ value: takenOfferEvent.takerGives, token: tokens.inboundToken });
    const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOfferEvent.id);
    const offer = await getOffer(offerId);

    assert(offer);

    const takenOffer: Omit<prisma.TakenOffer, "orderId"> = {
      id: new TakenOfferId(orderId, takenOfferEvent.id).value,
      offerVersionId: offer.currentVersionId,
      takerGot: takenOfferEvent.takerWants,
      takerGotNumber: takerGotBigNumber.toNumber(),
      takerGave: takenOfferEvent.takerGives,
      takerGaveNumber: takerGaveBigNumber.toNumber(),
      takerPaidPrice: getPrice({ over: takerGaveBigNumber, under: takerGotBigNumber }),
      makerPaidPrice: getPrice({ over: takerGotBigNumber, under: takerGaveBigNumber }),
      failReason: takenOfferEvent.failReason ?? null,
      posthookData: takenOfferEvent.posthookData ?? null,
      posthookFailed: takenOfferEvent.posthookFailed ?? false,
    };

    return takenOffer;
  }




}
