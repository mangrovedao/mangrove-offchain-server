import * as prismaModel from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { getBigNumber, getNumber, getPrice } from "../../state/handlers/handlerUtils";
import { MangroveOrderEventsLogic } from "../../state/handlers/stratsHandler/mangroveOrderEventsLogic";
import { AccountId, ChainId, MangroveId, OfferId, OfferListId, OrderId, TakenOfferId } from "../../state/model";
import { AccountOperations } from "./accountOperations";
import { DbOperations, PrismaTx } from "./dbOperations";
import { MangroveOrderOperations } from "./mangroveOrderOperations";
import { OfferListOperations } from "./offerListOperations";
import { OfferOperations } from "./offerOperations";

export class OrderOperations extends DbOperations {

  private offerOperations: OfferOperations;
  private mangroveOrderOperations: MangroveOrderOperations;
  private offerListOperations: OfferListOperations;
  private accountOperations: AccountOperations;
  private mangroveOrderEventsLogic: MangroveOrderEventsLogic = new MangroveOrderEventsLogic();
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
    await this.offerOperations.addVersionedOffer(offerId, "txId", (m) => m.deleted = true); //FIXME: no txId
    let updateFunc = ( tokens: { outboundToken: prismaModel.Token; inboundToken: prismaModel.Token; }, mangroveOrder: prismaModel.MangroveOrder, newVersion: Omit<prismaModel.MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">) => this.mangroveOrderEventsLogic.updateMangroveOrderFromTakenOffer( takenOffer, tokens, mangroveOrder, newVersion);
    await this.mangroveOrderOperations.updateMangroveOrderFromTakenOffer(
      offerId,
      updateFunc
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
