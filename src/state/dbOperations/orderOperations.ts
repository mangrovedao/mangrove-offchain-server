import * as prismaModel from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { MangroveOrderEventsLogic } from "../../state/handlers/stratsHandler/mangroveOrderEventsLogic";
import { MangroveId, OfferId, OrderId } from "../../state/model";
import { DbOperations, PrismaTx } from "./dbOperations";
import { MangroveOrderOperations } from "./mangroveOrderOperations";
import { OfferOperations } from "./offerOperations";

export class OrderOperations extends DbOperations {

  private offerOperations: OfferOperations;
  private mangroveOrderOperations: MangroveOrderOperations;
  private mangroveOrderEventsLogic: MangroveOrderEventsLogic = new MangroveOrderEventsLogic();
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
    takenOffers: Omit<prismaModel.TakenOffer, "orderId">[]
    ) {
      await this.tx.order.create( { data: { 
        ...order, 
        takenOffers: {
          createMany: {data: takenOffers }
      } } });

      // Updates offerVersions and possible mangroveOrderVersions
      for( const takenOffer of takenOffers){
        const offerVersion = await this.tx.offerVersion.findUnique({where: {id: takenOffer.offerVersionId}});
        if(!offerVersion){
          throw new Error(`Could no find OfferVersion from takenOffer.offerVersionId: ${takenOffer.offerVersionId}`);
        }
        const offer = await this.tx.offer.findUnique({where: {id: offerVersion?.offerId}});
        if(!offer){
          throw new Error(`Could not find offer matching takenOffer with offerVersion id: ${takenOffer.offerVersionId}`)
        }
        const currentVersionId =  await this.offerOperations.getCurrentOfferVersion(offer);
        if( currentVersionId.id != takenOffer.offerVersionId){
          throw new Error(`Cannot take version of offer that is not the current version of the offer. currentOfferVersionId: ${currentVersionId} & takenOffer.offerVersionId: ${takenOffer.offerVersionId}`)
        }
        await this.offerOperations.addVersionedOffer(new OfferId(orderId.mangroveId, orderId.offerListKey, offer.offerNumber), order.txId, (m) => m.deleted = true); 
        let updateFunc = ( 
          tokens: {
             outboundToken: prismaModel.Token; 
             inboundToken: prismaModel.Token; }, 
          mangroveOrder: prismaModel.MangroveOrder, 
          newVersion: Omit<prismaModel.MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">) =>
           this.mangroveOrderEventsLogic.newVersionOfMangroveOrderFromTakenOffer( takenOffer, tokens, mangroveOrder, newVersion);
        await this.mangroveOrderOperations.updateMangroveOrderFromTakenOffer(
          new OfferId(orderId.mangroveId, orderId.offerListKey, offer.offerNumber),
          updateFunc
          );
      };
  }
}
