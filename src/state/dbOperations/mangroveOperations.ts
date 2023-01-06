import * as prisma from "@prisma/client";
import _ from "lodash";
import { MangroveId, MangroveVersionId } from "src/state/model";
import { DbOperations, toUpsert } from "./dbOperations";

export class MangroveOperations extends DbOperations {

  // Add a new MangroveVersion to an existing Mangrove
  public async addVersionedMangrove(params:{
    id: MangroveId,
    txId: string | null,
    updateFunc?: (model: Omit< prisma.MangroveVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">) => void,
    address?:string,
  }) {
    let mangrove: prisma.Mangrove | null = await this.tx.mangrove.findUnique({
      where: { id: params.id.value },
    });

    if(mangrove && !params.updateFunc){
      throw new Error( `You are trying to create a new version of an existing Mangrove ${mangrove.id}, but gave no updateFunction`)
    }
    
    let newVersion: prisma.MangroveVersion;

    if( mangrove === null){
      if(!params.address){
        throw new Error( `Can't create Mangrove without an address, id:${params.id.value}`);
      }
      const newVersionId = new MangroveVersionId(params.id, 0);
      mangrove = {
          id: params.id.value,
          chainId: params.id.chainId.value,
          address: params.address,
          currentVersionId: newVersionId.value,
        };
      newVersion= {
          id: newVersionId.value,
          mangroveId: params.id.value,
          txId: params.txId,
          versionNumber: 0,
          prevVersionId: null,
          governance: null,
          monitor: null,
          vault: null,
          useOracle: null,
          notify: null,
          gasmax: null,
          gasprice: null,
          dead: null,
        };
    } else {
          const oldVersion = await this.getCurrentMangroveVersion(mangrove);
          const newVersionNumber = oldVersion.versionNumber + 1;
          const newVersionId = new MangroveVersionId(params.id, newVersionNumber);
          newVersion = _.merge(oldVersion, {
            id: newVersionId.value,
            txId: params.txId,
            versionNumber: newVersionNumber,
            prevVersionId: oldVersion.id,
          });

    }
    if( params.updateFunc){
      params.updateFunc(newVersion);
    }

    await this.tx.mangrove.upsert(
      toUpsert(
        _.merge(mangrove, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.mangroveVersion.create({ data: newVersion });
    

  }

  async getCurrentMangroveVersion(idOrMangrove: MangroveId | prisma.Mangrove) {
    const id = this.getId(idOrMangrove);
    const mangrove = await this.tx.mangrove.findUnique({where: { id: id}})
    if(!mangrove){
      throw new Error(`Could not find mangrove from id: ${id}`);
    }
    const currentVersion = await this.tx.mangroveVersion.findUnique({
      where: { id: mangrove.currentVersionId },
    });
    if (currentVersion === null) {
      throw new Error(`Current MangroveVersion not found, currentVersionId: ${currentVersion}`);
    }
    return currentVersion;
  }

  getId(idOrMangrove: MangroveId | prisma.Mangrove) {
    return "id" in idOrMangrove ? idOrMangrove.id : (idOrMangrove as MangroveId).value;
  }

  public async deleteLatestMangroveVersion(id: MangroveId) {
    const mangrove = await this.tx.mangrove.findUnique({
      where: { id: id.value },
    });
    if (mangrove === null) {
      throw Error(`Mangrove not found - id: ${id}`);
    }

    const mangroveVersion = await this.tx.mangroveVersion.findUnique({
      where: { id: mangrove.currentVersionId },
    });
    
    
    if (mangroveVersion!.prevVersionId === null) {
      await this.tx.mangrove.update({
        where: { id: id.value },
        data: { 
          currentVersionId: "",
         }, 
      });
      await this.tx.mangroveVersion.delete({
        where: { id: mangrove.currentVersionId },
      });
      await this.tx.mangrove.delete({ where: { id: id.value } });
    } else {
      await this.tx.mangrove.update({
        where: { id: id.value },
        data: { 
          currentVersionId: mangroveVersion!.prevVersionId,
         }, 
      });
      await this.tx.mangroveVersion.delete({
        where: { id: mangrove.currentVersionId },
      });
    }
    

  }
}
