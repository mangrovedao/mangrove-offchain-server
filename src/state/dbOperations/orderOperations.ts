import * as prismaModel from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import BigNumber from "bignumber.js";
import { PrismaTransaction } from "common/prismaStateTransitionHandler";
import { getBigNumber, getNumber, getPrice } from "../../state/handlers/handlerUtils";
import { AccountId, ChainId, MangroveId, OfferId, OfferListId, OrderId, TakenOfferId } from "../../state/model";
import { AllDbOperations } from "./allDbOperations";
import { DbOperations, PrismaTx } from "./dbOperations";
import { MangroveOrderOperations } from "./mangroveOrderOperations";
import { OfferOperations } from "./offerOperations";
import { OfferListOperations } from "./offerListOperations";
import { AccountOperations } from "./accountOperations";

export class OrderOperations extends DbOperations {

  private offerOperations: OfferOperations;
  private mangroveOrderOperations: MangroveOrderOperations;
  private offerListOperations: OfferListOperations;
  private accountOperations: AccountOperations;
  public constructor(public readonly tx: PrismaTx) {
    super(tx);
    this.offerOperations = new OfferOperations(tx);
    this.mangroveOrderOperations = new MangroveOrderOperations(tx);
    this.offerListOperations = new OfferListOperations(tx);
    this.accountOperations = new AccountOperations(tx);
  }
  public async deleteOrder(id: OrderId) {
    await this.tx.order.deleteMany({ where: { id: id.value } });
  }

  public async undoOrder(mangroveId:MangroveId, offerList: mangroveSchema.core.OfferList, orderId:OrderId, order:{ takenOffers:{id:number}[]} ){
    await this.deleteOrder(orderId);
    for (const takenOffer of order.takenOffers) {
      await this.offerOperations.deleteLatestOfferVersion(
        new OfferId(mangroveId, offerList, takenOffer.id)
      );
    }
  }

  public async mapTakenOffer(
    orderId: OrderId,
    takenOfferEvent: mangroveSchema.core.TakenOffer,
    inboundToken: {decimals: number},
    outboundToken: {decimals: number},
  ) {
    const takerGotBigNumber = getBigNumber({ value: takenOfferEvent.takerWants, token: outboundToken} );
    const takerGaveBigNumber = getBigNumber({ value: takenOfferEvent.takerGives, token: inboundToken} );
    const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOfferEvent.id);
    const offer = await this.offerOperations.getOffer(offerId);

    const takenOffer = {
      id: new TakenOfferId(orderId, takenOfferEvent.id).value,
      offerVersion: {
        connect: { id: offer?.currentVersionId },
      },
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
    await this.offerOperations.markOfferAsDeleted(offerId);
    await this.mangroveOrderOperations.updateMangroveOrderFromTakenOffer(
      takenOffer,
      offerId
    );
    return takenOffer;
  }

  public async createOrder(
    mangroveId: MangroveId, 
    offerList: mangroveSchema.core.OfferList, 
    order: mangroveSchema.core.Order, 
    chainId: ChainId, 
    orderId: OrderId, 
    txId: string, 
    parentOrderId?: OrderId
    ) {
    const offerListId = new OfferListId(mangroveId, offerList);
  
    const { outboundToken, inboundToken } = await this.offerListOperations.getOfferListTokens({
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

    // create order and taken offers
    // taken offer is not an aggregate
    const takerAccountId = new AccountId(chainId, order.taker);
    await this.accountOperations.ensureAccount(takerAccountId);
    await this.tx.order.create({
      data: {
        id: orderId.value,
        txId: txId,
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
        takenOffers: {
          create: await Promise.all(
            order.takenOffers.map((o) => this.mapTakenOffer(orderId, o, inboundToken, outboundToken)
            )
          ),
        },
      },
    });
  }
}
