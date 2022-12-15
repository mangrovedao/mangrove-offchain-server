import * as prisma from "@prisma/client";
import _ from "lodash";
import {
  ChainId,
  OfferListId,
  OfferListVersionId,
  TokenId,
} from "../../state/model";
import { DbOperations, toUpsert } from "./dbOperations";

export class OfferListOperations extends DbOperations {
  public async getOfferListTokens(
    params:
      | {
          id: OfferListId;
        }
      | {
          mangroveOrder: { offerListId: string };
        }
  ): Promise<{ outboundToken: prisma.Token; inboundToken: prisma.Token }> {
    const offerList = await this.tx.offerList.findUnique({
      where: {
        id: "id" in params ? params.id.value : params.mangroveOrder.offerListId,
      },
      include: {
        outboundToken: true,
        inboundToken: true,
      },
    });
    if (offerList === null) {
      if ("id" in params) {
        throw new Error(
          `offer list ${params.id.value} doesn't exist - chainId=${params.id.mangroveId.chainId.value}, mangroveId=${params.id.mangroveId.value}, outboundToken=${params.id.offerListKey.outboundToken},  inboundToken=${params.id.offerListKey.inboundToken}`
        );
      } else {
        throw new Error(
          `offer list ${params.mangroveOrder.offerListId} doesn't exist `
        );
      }
    }
    return {
      outboundToken: offerList!.outboundToken,
      inboundToken: offerList!.inboundToken,
    };
  }
  // Add a new OfferListVersion to a (possibly new) OfferList
  public async addVersionedOfferList(
    id: OfferListId,
    txId: string,
    updateFunc: (model: prisma.OfferListVersion) => void
  ) {
    let offerList: prisma.OfferList | null = await this.tx.offerList.findUnique(
      {
        where: { id: id.value },
      }
    );
    let newVersion: prisma.OfferListVersion;

    if (offerList === null) {
      const chainId = id.mangroveId.chainId;
      const inboundTokenId = new TokenId(chainId, id.offerListKey.inboundToken);
      const outboundTokenId = new TokenId(
        chainId,
        id.offerListKey.outboundToken
      );
      const newVersionId = new OfferListVersionId(id, 0);
      offerList = {
        id: id.value,
        mangroveId: id.mangroveId.value,
        outboundTokenId: outboundTokenId.value,
        inboundTokenId: inboundTokenId.value,
        currentVersionId: newVersionId.value,
      };
      newVersion = {
        id: newVersionId.value,
        offerListId: id.value,
        txId: txId,
        versionNumber: 0,
        prevVersionId: null,
        active: null,
        density: null,
        gasbase: null,
        fee: null,
      };
    } else {
      const oldVersionId = offerList.currentVersionId;
      const oldVersion = await this.tx.offerListVersion.findUnique({
        where: { id: oldVersionId },
      });
      if (oldVersion === null) {
        throw new Error(`Old OfferListVersion not found, id: ${oldVersionId}`);
      }
      const newVersionNumber = oldVersion.versionNumber + 1;
      const newVersionId = new OfferListVersionId(id, newVersionNumber);
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersionId,
      });
    }

    updateFunc(newVersion);

    await this.tx.offerList.upsert(
      toUpsert(
        _.merge(offerList, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.offerListVersion.create({ data: newVersion });
  }

  public async deleteLatestOfferListVersion(id: OfferListId) {
    const offerList = await this.tx.offerList.findUnique({
      where: { id: id.value },
    });
    if (offerList === null)
      throw Error(`OfferList not found - id: ${id.value}`);

    const offerListVersion = await this.tx.offerListVersion.findUnique({
      where: { id: offerList.currentVersionId },
    });
    await this.tx.offerListVersion.delete({
      where: { id: offerList.currentVersionId },
    });

    if (offerListVersion!.prevVersionId === null) {
      await this.tx.offerList.delete({ where: { id: id.value } });
    } else {
      offerList.currentVersionId = offerListVersion!.prevVersionId;
      await this.tx.offerList.update({
        where: { id: id.value },
        data: offerList,
      });
    }
  }
}
