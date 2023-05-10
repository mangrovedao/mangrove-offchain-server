import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListingId,
  OfferVersionId,
  OrderId,
  TakenOfferId,
  TokenBalanceId,
  TokenId
} from "src/state/model";
import { getFromBigNumber, fromBigNumber, getPrice } from "src/utils/numberUtils";
import { AllDbOperations } from "src/state/dbOperations/allDbOperations";
import BigNumber from "bignumber.js";
import { EventsLogic } from "../eventsLogic";

export class OrderEventLogic extends EventsLogic {
  db: AllDbOperations;
  orderEventsLogicHelper = new OrderEventLogicHelper();
  constructor(db: AllDbOperations, stream:string) {
      super(stream);
      this.db = db;
  }


  async handleOrderCompleted(
    txRef: any,
    order: mangroveSchema.core.Order,
    offerList: mangroveSchema.core.OfferList,
    id: string,
    undo: boolean,
    mangroveId: MangroveId,
    chainId: ChainId,
    transaction: prisma.Transaction | undefined,
    parentOrderId: OrderId | undefined,
  ) {
    assert(txRef);
    const orderId = new OrderId(mangroveId, offerList, id);

    if (undo) {
      await this.db.orderOperations.undoOrder(mangroveId, offerList, orderId, order);

      return;
    }
    const takerAccountId = new AccountId(chainId, order.taker);
    await this.db.accountOperations.ensureAccount(takerAccountId);

    const offerListingId = new OfferListingId(mangroveId, offerList);

    const tokens = await this.db.offerListOperations.getOfferListTokens({
      id: offerListingId,
    });
    const prismaOrder = this.orderEventsLogicHelper.createOrder(mangroveId, offerListingId, tokens, order, takerAccountId, orderId, transaction!.id, parentOrderId);
    const takenOffersWithEvents = await Promise.all(order.takenOffers.map((value) => this.orderEventsLogicHelper.mapTakenOffer(orderId, value, tokens, (o) => this.db.offerOperations.getOfferWithCurrentVersion(o))));
    const takenOffers: Omit<prisma.TakenOffer, "orderId">[] = takenOffersWithEvents.map(value => value.takenOffer);

    await this.db.orderOperations.createOrder(orderId, prismaOrder, takenOffersWithEvents);

    for (let i = 0; i < takenOffersWithEvents.length; i++) {
      const { takenOffer, takenOfferEvent } = takenOffersWithEvents[i];
      const offer = await this.db.offerOperations.getOffer(new OfferId(mangroveId, offerList, takenOfferEvent.id));
      assert(offer);
      const kandel = await this.db.kandelOperations.getKandelFromOffer(offer)
      const takenOfferId = new TakenOfferId(orderId, takenOfferEvent.id);
      const { inboundToken, outboundToken } = await this.db.offerListOperations.getOfferListTokens({ id: offerListingId });
      const maker = await this.db.accountOperations.getAccount(offer.makerId);
      const makerId = new AccountId( mangroveId.chainId, maker ? maker.address: "")
      await this.addNewInboundBalanceWithEvent(chainId, makerId, inboundToken, transaction!.id, takenOfferId, takenOffer)
      await this.addNewOutboundBalanceWithEvent(chainId, makerId, outboundToken, transaction!.id, takenOfferId, takenOffer)
      if (!kandel || kandel.reserveId == offer.makerId ) {
        continue
      } 

      const reserveAddress = await this.db.kandelOperations.getReserveAddress({ kandel })
      const reserveId = new AccountId(chainId, reserveAddress);
        
      await this.addNewInboundBalanceWithEvent(chainId, reserveId, inboundToken, transaction!.id, takenOfferId, takenOffer)
      await this.addNewOutboundBalanceWithEvent(chainId, reserveId, outboundToken, transaction!.id, takenOfferId, takenOffer)
      
    }

  }

  async addNewInboundBalanceWithEvent(chainId:ChainId, reserveId:AccountId, inboundToken:prisma.Token, txId:string, takenOfferId:TakenOfferId, takenOffer:Omit<prisma.TakenOffer, "orderId">) {
    const inboundTokenId = new TokenId(chainId, inboundToken.address);
    const inboundTokenBalanceId = new TokenBalanceId({ accountId: reserveId, tokenId: inboundTokenId, stream: this.stream })
    const { updatedOrNewTokenBalance, newVersion:newInboundBalance } = await this.db.tokenBalanceOperations.addTokenBalanceVersion({
      tokenBalanceId: inboundTokenBalanceId,
      txId: txId,
      updateFunc: (tokenBalanceVersion) => {
        tokenBalanceVersion.received = new BigNumber(takenOffer.takerGave).plus(tokenBalanceVersion.received).toString();
        tokenBalanceVersion.balance = new BigNumber(takenOffer.takerGave).plus(tokenBalanceVersion.balance).toString();
      }
    })
    await this. db.tokenBalanceOperations.createTokenBalanceEvent(reserveId, inboundTokenId, newInboundBalance, takenOfferId)
  }

  async addNewOutboundBalanceWithEvent(chainId:ChainId, reserveId:AccountId, outboundToken:prisma.Token, txId:string, takenOfferId:TakenOfferId, takenOffer:Omit<prisma.TakenOffer, "orderId">) {
    const outboundTokenId = new TokenId(chainId, outboundToken.address);
    const outboundTokenBalanceId = new TokenBalanceId({ accountId: reserveId, tokenId: outboundTokenId, stream: this.stream })
    const { updatedOrNewTokenBalance, newVersion:newOutboundBalance } = await this.db.tokenBalanceOperations.addTokenBalanceVersion({
      tokenBalanceId: outboundTokenBalanceId,
      txId: txId,
      updateFunc: (tokenBalanceVersion) => {
        tokenBalanceVersion.send = new BigNumber(takenOffer.takerGot).plus(tokenBalanceVersion.send).toString();
        tokenBalanceVersion.balance = new BigNumber(takenOffer.takerGot).minus(tokenBalanceVersion.balance).toString();
      }
    })
    await this. db.tokenBalanceOperations.createTokenBalanceEvent(reserveId, outboundTokenId, newOutboundBalance, takenOfferId)
  }
}
export class OrderEventLogicHelper {

  createOrder(
    mangroveId: MangroveId,
    offerListingId: OfferListingId,
    tokens: { inboundToken: { decimals: number }, outboundToken: { decimals: number } },
    order: Omit<mangroveSchema.core.Order, "takenOffers" | "taker">,
    takerId: AccountId,
    orderId: OrderId,
    txId: string,
    parentOrderId?: OrderId,
  ) {

    const takerGotBigNumber = getFromBigNumber({
      value: order.takerGot,
      token: tokens.outboundToken,
    });
    const takerGaveBigNumber = getFromBigNumber({
      value: order.takerGave,
      token: tokens.inboundToken,
    });

    const prismaOrder: prisma.Order = {
      id: orderId.value,
      txId: txId,
      proximaId: orderId.proximaId,
      parentOrderId: parentOrderId?.value ?? null,
      offerListingId: offerListingId.value,
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
      bountyNumber: fromBigNumber({ value: order.penalty, decimals: 18 }),
      totalFee: order.feePaid.length == 0 ? "0" : order.feePaid,
      totalFeeNumber: order.feePaid.length == 0 ? 0 : fromBigNumber({
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
    getOffer: (offerId: OfferId) => Promise<( {
      currentVersion: {versionNumber: number, wants: string} | null;
  }) | null>,
  ) {
    const takerGotBigNumber = getFromBigNumber({ value: takenOfferEvent.takerWants, token: tokens.outboundToken });
    const takerGaveBigNumber = getFromBigNumber({ value: takenOfferEvent.takerGives, token: tokens.inboundToken });
    const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOfferEvent.id);
    const offer = await getOffer(offerId);
    const currentVersion = offer?.currentVersion;
    assert(offer);
    assert(currentVersion);
    
    
    const takenOffer: Omit<prisma.TakenOffer, "orderId"> = {
      id: new TakenOfferId(orderId, takenOfferEvent.id).value,
      offerVersionId: new OfferVersionId(offerId, currentVersion.versionNumber +1).value,
      takerGot: takenOfferEvent.takerWants,
      takerGotNumber: takerGotBigNumber.toNumber(),
      takerGave: takenOfferEvent.takerGives,
      takerGaveNumber: takerGaveBigNumber.toNumber(),
      takerPaidPrice: getPrice({ over: takerGaveBigNumber, under: takerGotBigNumber }),
      makerPaidPrice: getPrice({ over: takerGotBigNumber, under: takerGaveBigNumber }),
      failReason: takenOfferEvent.failReason ?? null,
      posthookData: takenOfferEvent.posthookData ?? null,
      posthookFailed: takenOfferEvent.posthookFailed ?? false,
      fullyTaken: currentVersion.wants == takenOfferEvent.takerGives,
    };

    return { takenOffer, takenOfferEvent };
  }




}
