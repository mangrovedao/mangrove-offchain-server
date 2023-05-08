import * as prismaModel from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { MangroveId, OfferId, OrderId } from "src/state/model";
import { DbOperations, PrismaTx } from "./dbOperations";
import { MangroveOrderOperations } from "./mangroveOrderOperations";
import { OfferOperations } from "./offerOperations";

export class OrderOperations extends DbOperations {

  private offerOperations: OfferOperations;
  private mangroveOrderOperations: MangroveOrderOperations;
  // private mangroveOrderEventsLogic: MangroveOrderEventsLogic = new MangroveOrderEventsLogic();
  public constructor(public readonly tx: PrismaTx) {
    super(tx);
    this.offerOperations = new OfferOperations(tx);
    this.mangroveOrderOperations = new MangroveOrderOperations(tx);
  }
  public async deleteOrder(id: OrderId) {
    await this.tx.order.delete({ where: { id: id.value } });
  }

  public async undoOrder(mangroveId:MangroveId, offerList: mangroveSchema.core.OfferList, orderId:OrderId, order:{ takenOffers:{id:number}[]} ){
    await this.deleteOrder(orderId);
    for (const takenOffer of order.takenOffers) {
      const offerId = new OfferId(mangroveId, offerList, takenOffer.id);
      await this.offerOperations.deleteLatestOfferVersion(
        offerId
      );
      await this.mangroveOrderOperations.deleteLatestMangroveOrderVersionUsingOfferId( offerId);
    }
  }

  public async createOrder(
    orderId: OrderId,
    order: prismaModel.Order,
    takenOffers: {
      takenOffer: Omit<prismaModel.TakenOffer, "orderId">;
      takenOfferEvent: {id:number};
  }[]
    ) {
      await this.tx.order.create( { data: { 
        ...order, 
        takenOffers: {
          createMany: {data: takenOffers.map( v => v.takenOffer) }
      } } });

      // Updates offerVersions and possible mangroveOrderVersions
      for( const takenOfferData of takenOffers){

        const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, takenOfferData.takenOfferEvent.id);
        const offer = await this.tx.offer.findUnique({where: {id: offerId.value}});
        if(!offer){
          throw new Error(`Could not find offer matching takenOffer with offer id: ${offerId.value}`)
        }
        const currentVersionId =  await this.offerOperations.getCurrentOfferVersion(offer);
        const newOfferVersion = await this.offerOperations.addVersionedOffer(new OfferId(orderId.mangroveId, orderId.offerListKey, offer.offerNumber), order.txId, (m) => m.deleted = true); 
        if( newOfferVersion.id != takenOfferData.takenOffer.offerVersionId){
          throw new Error(`Cannot take version of offer that is not the current version of the offer. currentOfferVersionId: ${newOfferVersion.id} & takenOffer.offerVersionId: ${takenOfferData.takenOffer.offerVersionId}`)
        }
      };
  }

}
