import { AccountId, OfferListId, OrderId, TakerApprovalId, TakerApprovalVersionId } from "state/model";
import { DbOperations, toUpsert } from "./dbOperations";
import * as _ from "lodash";
import * as prisma from "@prisma/client";


export class TakerApprovalOperations extends DbOperations {
      // Add a new TakerApprovalVersion to a (possibly new) TakerApproval
  public async addVersionedTakerApproval(
    id: TakerApprovalId,
    tx: prisma.Transaction,
    updateFunc: (model: prisma.TakerApprovalVersion) => void,
    parentOrderId?: OrderId
  ) {
    let takerApproval: prisma.TakerApproval | null =
      await this.tx.takerApproval.findUnique({
        where: { id: id.value },
      });
    let newVersion: prisma.TakerApprovalVersion;

    if (takerApproval === null) {
      const newVersionId = new TakerApprovalVersionId(id, 0);
      takerApproval = {
        id: id.value,
        mangroveId: id.mangroveId.value,
        ownerId: new AccountId(id.mangroveId.chainId, id.ownerAddress).value,
        spenderId: new AccountId(id.mangroveId.chainId, id.spenderAddress)
            .value,
        offerListId: new OfferListId(id.mangroveId, id.offerListKey).value,
        currentVersionId: newVersionId.value,
      };
      newVersion = {
        id: newVersionId.value,
        takerApprovalId: id.value,
        txId: tx.id,
        parentOrderId: parentOrderId?.value ?? null,
        versionNumber: 0,
        prevVersionId: null,
        value: "0",
      };
    } else {
      const oldVersionId = takerApproval.currentVersionId;
      const oldVersion = await this.tx.takerApprovalVersion.findUnique({
        where: { id: oldVersionId },
      });
      if (oldVersion === null) {
        throw new Error(
          `Old TakerApprovalVersion not found, id: ${oldVersionId}`
        );
      }
      const newVersionNumber = oldVersion.versionNumber + 1;
      const newVersionId = new TakerApprovalVersionId(id, newVersionNumber);
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersionId,
      });
    }

    updateFunc(newVersion);

    await this.tx.takerApproval.upsert(
      toUpsert(
        _.merge(takerApproval, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.takerApprovalVersion.create({ data: newVersion });
  }

  public async deleteLatestTakerApprovalVersion(id: TakerApprovalId) {
    const takerApproval = await this.tx.takerApproval.findUnique({
      where: { id: id.value },
    });
    if (takerApproval === null)
      throw Error(`TakerApproval not found - id: ${id.value}`);

    const currentVersion = await this.tx.takerApprovalVersion.findUnique({
      where: { id: takerApproval.currentVersionId },
    });
    await this.tx.takerApprovalVersion.delete({
      where: { id: takerApproval.currentVersionId },
    });

    if (currentVersion!.prevVersionId === null) {
      await this.tx.takerApproval.delete({ where: { id: id.value } });
    } else {
      takerApproval.currentVersionId = currentVersion!.prevVersionId;
      await this.tx.takerApproval.update({
        where: { id: id.value },
        data: takerApproval,
      });
    }
  }
}