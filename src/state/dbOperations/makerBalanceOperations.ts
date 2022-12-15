import { DbOperations, toUpsert } from "./dbOperations";
import * as _ from "lodash";
import * as prisma from "@prisma/client";
import {
  AccountId,
  MakerBalanceId,
  MakerBalanceVersionId,
} from "../../state/model";

export class MakerBalanceOperations extends DbOperations {
  // Add a new MakerBalanceVersion to a (possibly new) MakerBalance
  public async addVersionedMakerBalance(
    id: MakerBalanceId,
    txId: string,
    updateFunc: (model: prisma.MakerBalanceVersion) => void
  ) {
    let makerBalance: prisma.MakerBalance | null =
      await this.tx.makerBalance.findUnique({
        where: { id: id.value },
      });
    let newVersion: prisma.MakerBalanceVersion;

    if (makerBalance === null) {
      const newVersionId = new MakerBalanceVersionId(id, 0);
      makerBalance = {
        id: id.value,
        mangroveId: id.mangroveId.value,
        makerId: new AccountId(id.mangroveId.chainId, id.address).value,
        currentVersionId: newVersionId.value,
      };
      newVersion = {
        id: newVersionId.value,
        makerBalanceId: id.value,
        txId: txId,
        versionNumber: 0,
        prevVersionId: null,
        balance: "0",
      };
    } else {
      const oldVersion = await this.getCurrentMakerBalanceVersion(makerBalance);
      const newVersionNumber = oldVersion.versionNumber + 1;
      const newVersionId = new MakerBalanceVersionId(id, newVersionNumber);
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersion.id,
      });
    }

    updateFunc(newVersion);

    await this.tx.makerBalance.upsert(
      toUpsert(
        _.merge(makerBalance, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.makerBalanceVersion.create({ data: newVersion });
  }

  public async getCurrentMakerBalanceVersion(makerBalance: {
    currentVersionId: string;
  }) {
    const currentVersionId = makerBalance.currentVersionId;
    const currentVersion = await this.tx.makerBalanceVersion.findUnique({
      where: { id: currentVersionId },
    });
    if (currentVersion === null) {
      throw new Error(
        `Current MakerBalanceVersion not found, id: ${currentVersionId}`
      );
    }
    return currentVersion;
  }

  public async deleteLatestMakerBalanceVersion(id: MakerBalanceId) {
    const makerBalance = await this.tx.makerBalance.findUnique({
      where: { id: id.value },
    });
    if (makerBalance === null)
      throw Error(`MakerBalance not found - id: ${id.value}`);

    const currentVersion = await this.tx.makerBalanceVersion.findUnique({
      where: { id: makerBalance.currentVersionId },
    });
    await this.tx.makerBalanceVersion.delete({
      where: { id: makerBalance.currentVersionId },
    });

    if (currentVersion!.prevVersionId === null) {
      await this.tx.makerBalance.delete({ where: { id: id.value } });
    } else {
      makerBalance.currentVersionId = currentVersion!.prevVersionId;
      await this.tx.makerBalance.update({
        where: { id: id.value },
        data: makerBalance,
      });
    }
  }
}
