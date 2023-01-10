import * as prisma from "@prisma/client";
import { MangroveOrder } from "@prisma/client";
import * as _ from "lodash";
import {
  MangroveId,
  MangroveOrderId,
  MangroveOrderVersionId,
  OfferId,
  OfferListingId,
  StratId
} from "src/state/model";
import { DbOperations, PrismaTx, toUpsert } from "./dbOperations";
import { OfferListingOperations } from "./offerListingOperations";

export type MangroveOrderIds = {
  mangroveOrderId: string;
  txId: string;
  mangroveId: string;
  stratId: string;
  offerListingId: string;
  takerId: string;
  // orderId: string;
  currentVersionId: string;
};

export class MangroveOrderOperations extends DbOperations {
  private offerListingOperations: OfferListingOperations;
  public constructor(public readonly tx: PrismaTx) {
    super(tx);
    this.offerListingOperations = new OfferListingOperations(tx);
  }

  public async addMangroveOrderVersionFromOfferId(
    id: OfferId,
    txId:string,
    updateFunc:(model: Omit<
      prisma.MangroveOrderVersion,
      "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId"
    >) => void,
  ) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: id.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      const mangroveOrderVersion = await this.getCurrentMangroveOrderVersion( mangroveOrder );
      updateFunc(mangroveOrderVersion);
      await this.addMangroveOrderVersion(
        new MangroveOrderId(id.mangroveId, id.offerListKey, mangroveOrder.proximaId ),
        txId,
        updateFunc,
    );
    }
  }

  public async getCurrentMangroveOrderVersion(
    idOrOrder: MangroveOrder | MangroveOrderId 
  ) {
    const id = idOrOrder instanceof MangroveOrderId ? idOrOrder.value : (idOrOrder as MangroveOrder).id;

    const mangroveOrder = await this.tx.mangroveOrder.findUnique({
      where: {
        id: id
      },
    });
    if (!mangroveOrder) {
      throw Error(`Could not find mangroveOrder from: ${idOrOrder}`);
    }
    const version = await this.tx.mangroveOrderVersion.findUnique({
      where: {
        id: mangroveOrder.currentVersionId,
      },
    });
    if (!version) {
      throw Error(
        `Could not find mangroveOrderVersion, from mangroveOrder: ${mangroveOrder}`
      );
    }
    return version;
  }

  public async addMangroveOrderVersion(
    id: MangroveOrderId,
    txId: string,
    updateFunc:(model: Omit< prisma.MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId" >) => void,
    initial?: Omit<prisma.MangroveOrder,"id" | "mangroveId" | "offerListingId" | "proximaId" |  "currentVersionId" >
    ) {
      
    let mangroveOrder = await this.tx.mangroveOrder.findUnique({
      where: { id: id.value },
    });

    let newVersion:prisma.MangroveOrderVersion;

    if( mangroveOrder === null){
      if(!initial){
        throw new Error( `Can't create MangroveOrder without initial values for creation, id: ${id.value}`);
      }
      
      const newVersionId = new MangroveOrderVersionId({ mangroveOrderId: id, versionNumber:0});
      mangroveOrder = { ...initial,
        ...{
        id: id.value,
        mangroveId:  id.mangroveId.value,
        offerListingId: new OfferListingId( id.mangroveId, id.offerListKey ).value,
        currentVersionId: newVersionId.value,
        proximaId: id.proximaId
        
      }};
      newVersion = {
        id: newVersionId.value,
        txId: txId,
        mangroveOrderId: id.value,
        filled: false,
        cancelled: false,
        failed: false,
        failedReason: null,
        takerGot: "0",
        takerGotNumber: 0,
        takerGave: "0",
        takerGaveNumber: 0,
        price: 0,
        expiryDate: new Date("0"),
        versionNumber: 0,
        prevVersionId: null
      }
    } else {

      let oldVersion = await this.getCurrentMangroveOrderVersion(mangroveOrder);
      const newVersionNumber =
        oldVersion === null ? 0 : oldVersion.versionNumber + 1;
      const newVersionId = new MangroveOrderVersionId({
        mangroveOrderId: id,
        versionNumber: newVersionNumber,
      });

      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        txId: txId,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersion.id,
      });
    }
    updateFunc(newVersion);
    await this.tx.mangroveOrder.upsert(
      toUpsert(
        _.merge(mangroveOrder, {
          currentVersionId: newVersion.id,
        })
      )
    );
    await this.tx.mangroveOrderVersion.create({ data: newVersion });
  }


  public async deleteLatestMangroveOrderVersionUsingOfferId(id: OfferId) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: id.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      await this.deleteLatestVersionOfMangroveOrder(
        mangroveOrder 
      );
    }
  }

  public async deleteLatestVersionOfMangroveOrder(idOrOrder: MangroveOrderId | MangroveOrder) {
    const id = "id" in  idOrOrder ? idOrOrder.id : ( idOrOrder as MangroveOrderId ).value;
   
    const mangroveOrder = await this.tx.mangroveOrder.findUnique({
      where: { id: id },
    });
    if (mangroveOrder === null)
      throw Error(`MangroveOrder not found - id: ${id}`);

    const version = await this.tx.mangroveOrderVersion.findUnique({
      where: { id: mangroveOrder.currentVersionId },
    });


    if (version!.prevVersionId === null) {
      await this.tx.mangroveOrder.update({
        where: { id: id },
        data: { 
          currentVersionId: "",
         }, 
      });
      await this.tx.mangroveOrderVersion.delete({
        where: { id: mangroveOrder.currentVersionId },
      });
      await this.tx.mangroveOrder.delete({ where: { id: id } });

    } else {
      await this.tx.mangroveOrder.update({
        where: { id: id },
        data: { currentVersionId: version!.prevVersionId}
      });
      await this.tx.mangroveOrderVersion.delete({
        where: { id: mangroveOrder.currentVersionId },
      });
    }
  }

  public async updateMangroveOrderFromTakenOffer(
    offerId: OfferId,
    updateFunc: (     tokens: {
      outboundToken: prisma.Token,
      inboundToken: prisma.Token,
  },
  mangroveOrder: MangroveOrder, 
  newVersion:Omit< prisma.MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId" > ) => void
  ) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: offerId.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      const tokens = await this.offerListingOperations.getOfferListTokens({
        mangroveOrder,
      });
      await this.addMangroveOrderVersion(
        new MangroveOrderId( offerId.mangroveId, offerId.offerListKey, mangroveOrder.proximaId ),
        "",
        ( m ) => updateFunc(tokens, mangroveOrder, m)
      );
    }
  }


  public async getMangroveIdByStratId(stratId:StratId){
    const mangroveOrder = await this.tx.mangroveOrder.findFirst({where: {stratId: stratId.value}});
    if( mangroveOrder){
      return new MangroveId(stratId.chainId, mangroveOrder.mangroveId);
    }
    return null;
  }

}
