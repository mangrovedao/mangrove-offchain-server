import assert from "assert";
import _ from "lodash";
import { ChainId, MangroveId, MangroveVersionId } from "../../state/model";
import { DbOperations, toUpsert } from "./dbOperations";
import * as prisma from "@prisma/client";

export class MangroveOperations extends DbOperations {
  public async createMangrove(
    id: MangroveId,
    chainId: ChainId,
    address: string,
    txId: string | null
  ) {
    const mangrove = await this.tx.mangrove.findUnique({
      where: { id: id.value },
    });

    if (mangrove) {
      throw Error(`Mangrove already exists for id: ${id}`);
    }
    const newVersionId = new MangroveVersionId(id, 0);
    await this.tx.mangrove.create({
      data: {
        id: id.value,
        chainId: chainId.value,
        address: address,
        currentVersionId: newVersionId.value,
      },
    });
    await this.tx.mangroveVersion.create({
      data: {
        id: newVersionId.value,
        mangroveId: id.value,
        txId: txId,
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
      },
    });
  }

  // Add a new MangroveVersion to an existing Mangrove
  public async addVersionedMangrove(
    id: MangroveId,
    updateFunc: (model: prisma.MangroveVersion) => void,
    txId: string | null
  ) {
    const mangrove: prisma.Mangrove | null = await this.tx.mangrove.findUnique({
      where: { id: id.value },
    });
    assert(mangrove);

    const oldVersionId = mangrove.currentVersionId;
    const oldVersion = await this.tx.mangroveVersion.findUnique({
      where: { id: oldVersionId },
    });
    if (oldVersion === null) {
      throw new Error(`Old MangroveVersion not found, id: ${oldVersionId}`);
    }
    const newVersionNumber = oldVersion.versionNumber + 1;
    const newVersionId = new MangroveVersionId(id, newVersionNumber);
    const newVersion = _.merge(oldVersion, {
      id: newVersionId.value,
      txId: txId,
      versionNumber: newVersionNumber,
      prevVersionId: oldVersionId,
    });

    updateFunc(newVersion);

    await this.tx.mangrove.upsert(
      toUpsert(
        _.merge(mangrove, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.mangroveVersion.create({ data: newVersion });
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
    await this.tx.mangroveVersion.delete({
      where: { id: mangrove.currentVersionId },
    });

    if (mangroveVersion!.prevVersionId === null) {
      await this.tx.mangrove.delete({ where: { id: id.value } });
    } else {
      mangrove.currentVersionId = mangroveVersion!.prevVersionId;
      await this.tx.mangrove.update({
        where: { id: id.value },
        data: mangrove,
      });
    }
  }
}
