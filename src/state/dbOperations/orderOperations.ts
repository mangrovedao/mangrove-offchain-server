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

export class OrderOperations extends DbOperations {

  private offerOperations: OfferOperations;
  private mangroveOrderOperations: MangroveOrderOperations;
  public constructor(public readonly tx: PrismaTx) {
    super(tx);
    this.offerOperations = new OfferOperations(tx);
    this.mangroveOrderOperations = new MangroveOrderOperations(tx);
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
    inboundToken: prismaModel.Token,
    outboundToken: prismaModel.Token,
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
      failReason: this.getFailReason(takenOfferEvent),
      posthookData: this.getPosthookData(takenOfferEvent),
      posthookFailed: this.getPosthookFailed(takenOfferEvent),
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
  

  private getFailReason(o: mangroveSchema.core.TakenOffer) {
    return o.failReason ? o.failReason : null;
  }

  private getPosthookData(o: mangroveSchema.core.TakenOffer) {
    return o.posthookData ? o.posthookData : null;
  }

  private getPosthookFailed(o: mangroveSchema.core.TakenOffer) {
    return o.posthookFailed == true;
  }

  public async createOrder(mangroveId: MangroveId, offerList: mangroveSchema.core.OfferList, db: AllDbOperations, order: mangroveSchema.core.Order, chainId: ChainId, tx: PrismaTransaction, orderId: OrderId, transaction: prismaModel.Transaction | undefined, parentOrderId: OrderId | undefined) {
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

    // create order and taken offers
    // taken offer is not an aggregate
    const takerAccountId = new AccountId(chainId, order.taker);
    await db.accountOperations.ensureAccount(takerAccountId);
    await tx.order.create({
      data: {
        id: orderId.value,
        txId: transaction!.id,
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
        takerPaidPrice: takerGotBigNumber.gt(0)
          ? takerGaveBigNumber.div(takerGotBigNumber).toNumber()
          : undefined,
        makerPaidPrice: takerGaveBigNumber.gt(0)
          ? takerGotBigNumber.div(takerGaveBigNumber).toNumber()
          : undefined,
        bounty: order.penalty,
        bountyNumber: getNumber({ value: order.penalty, decimals: 18 }),
        // totalFee: order.feePaid,
        // totalFeeNumber: getNumber({
        //   value: order.feePaid,
        //   token: outboundToken,
        // }),
        takenOffers: {
          create: await Promise.all(
            order.takenOffers.map((o) => db.orderOperations.mapTakenOffer(orderId, o, inboundToken, outboundToken)
            )
          ),
        },
      },
    });
  }
}
