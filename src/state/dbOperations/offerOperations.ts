import * as prisma from "@prisma/client";
import * as _ from "lodash";
import { AccountId, OfferId, OfferListingId, OfferVersionId } from "src/state/model";
import { DbOperations, toUpsert } from "./dbOperations";

export class OfferOperations extends DbOperations {

  public async getOffer(id: OfferId): Promise<prisma.Offer | null> {
    return await this.tx.offer.findUnique({ where: { id: id.value } });
  }


  // Add a new OfferVersion to a (possibly new) Offer
  public async addVersionedOffer(
    id: OfferId,
    txId: string,
    updateFunc: (version: Omit< prisma.OfferVersion, "id" | "offerId" | "versionNumber" | "prevVersionId" > ) => void,
    initial?: {
      makerId:AccountId
    }
  ) {
    let offer = (await this.getOffer(id));
    let newVersion:prisma.OfferVersion;
    if (offer === null) {
      if(!initial){
        throw new Error( `Can't create Offer without initial values for creation: ${id.value}`);
      }
      const newVersionId = new OfferVersionId(id, 0);
      offer = {
        id: id.value,
        mangroveId: id.mangroveId.value,
        offerListingId: new OfferListingId( id.mangroveId, id.offerListKey).value,
        offerNumber: id.offerNumber,
        makerId: initial.makerId.value,
        currentVersionId: newVersionId.value
      };
      newVersion = {
        id: newVersionId.value,
        offerId: id.value,
        txId: txId,
        parentOrderId: null,
        prevOfferId: null,
        deleted: false,
        wants: "0",
        wantsNumber: 0,
        gives: "0",
        givesNumber: 0,
        takerPaysPrice: 0,
        makerPaysPrice: 0,
        gasprice: 0,
        gasreq: 0,
        live: false,
        deprovisioned: false,
        versionNumber: 0,
        prevVersionId: null
      }
    }
    else {

      const oldVersion = await this.getCurrentOfferVersion(id);
      const newVersionNumber =
        oldVersion === null ? 0 : oldVersion.versionNumber + 1;
      const newVersionId = new OfferVersionId(id, newVersionNumber);
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        txId: txId,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersion.id,
      });

    }


    updateFunc(newVersion);


    await this.tx.offer.upsert(
      toUpsert(
        _.merge(offer, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.offerVersion.create({ data: newVersion });
  }


  async getCurrentOfferVersion(idOrOffer: OfferId | prisma.Offer) {
    const id = "id" in idOrOffer ? idOrOffer.id :  (idOrOffer as OfferId).value;
    const offer = await this.tx.offer.findUnique({
      where: { id: id },
    });
    if ( !offer ) {
      throw new Error(`Could not find offer from, id: ${id}`);
    }
    const offerVersion = await this.tx.offerVersion.findUnique({ where: { id : offer.currentVersionId}})
    if(!offerVersion){
      throw new Error(`Could not find offerVersion from id: ${offer.currentVersionId}`)
    }
    return offerVersion;
  }

  public async deleteLatestOfferVersion(id: OfferId) {
    const offer = await this.tx.offer.findUnique({ where: { id: id.value } });
    if (offer === null) throw Error(`Offer not found - id: ${id.value}`);

    const version = await this.tx.offerVersion.findUnique({
      where: { id: offer.currentVersionId },
    });
    if (version === null) throw Error(`OfferVersion not found - id: ${id.value}, currentVersionId: ${offer.currentVersionId}`);

    
    if (version.prevVersionId === null) {
      await this.tx.offer.update({
        where: { id: id.value },
        data: { 
          currentVersionId: "",
        }, 
      });
      await this.tx.offerVersion.delete({
        where: { id: offer.currentVersionId },
      });
      await this.tx.offer.delete({ where: { id: id.value } });
    } else {
      await this.tx.offer.update({ 
        where: { 
          id: id.value 
        }, 
        data: { 
          currentVersionId : version!.prevVersionId
        } 
      });
      await this.tx.offerVersion.delete({
        where: { id: offer.currentVersionId },
      });
    }
  }
}
