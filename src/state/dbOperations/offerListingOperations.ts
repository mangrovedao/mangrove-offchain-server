import * as prisma from "@prisma/client";
import _ from "lodash";
import {
  ChainId,
  OfferListingId,
  OfferListingVersionId,
  TokenId,
} from "src/state/model";
import { DbOperations, toUpsert } from "./dbOperations";

export class OfferListingOperations extends DbOperations {
  public async getOfferListTokens(
    params:
      | {
          id: OfferListingId;
        }
      | {
          mangroveOrder: { offerListingId: string };
        }
  ): Promise<{ outboundToken: prisma.Token; inboundToken: prisma.Token }> {
    const offerListing = await this.tx.offerListing.findUnique({
      where: {
        id: "id" in params ? params.id.value : params.mangroveOrder.offerListingId,
      },
      include: {
        outboundToken: true,
        inboundToken: true,
      },
    });
    if (offerListing === null) {
      if ("id" in params) {
        throw new Error(
          `offer list ${params.id.value} doesn't exist - chainId=${params.id.mangroveId.chainId.value}, mangroveId=${params.id.mangroveId.value}, outboundToken=${params.id.offerListKey.outboundToken},  inboundToken=${params.id.offerListKey.inboundToken}`
        );
      } else {
        throw new Error(
          `offer list ${params.mangroveOrder.offerListingId} doesn't exist `
        );
      }
    }
    return {
      outboundToken: offerListing!.outboundToken,
      inboundToken: offerListing!.inboundToken,
    };
  }
  // Add a new OfferListVersion to a (possibly new) OfferList
  public async addVersionedOfferList(
    id: OfferListingId,
    txId: string,
    updateFunc: (model: prisma.OfferListingVersion) => void
  ) {
    let offerListing: prisma.OfferListing | null = await this.tx.offerListing.findUnique(
      {
        where: { id: id.value },
      }
    );
    let newVersion: prisma.OfferListingVersion;

    if (offerListing === null) {
      const chainId = id.mangroveId.chainId;
      const inboundTokenId = new TokenId(chainId, id.offerListKey.inboundToken);
      const outboundTokenId = new TokenId(
        chainId,
        id.offerListKey.outboundToken
      );
      const newVersionId = new OfferListingVersionId(id, 0);
      offerListing = {
        id: id.value,
        mangroveId: id.mangroveId.value,
        outboundTokenId: outboundTokenId.value,
        inboundTokenId: inboundTokenId.value,
        currentVersionId: newVersionId.value,
      };
      newVersion = {
        id: newVersionId.value,
        offerListingId: id.value,
        txId: txId,
        versionNumber: 0,
        prevVersionId: null,
        active: null,
        density: null,
        gasbase: null,
        fee: null,
      };
    } else {
      const oldVersion = await this.getCurrentOfferListVersion(offerListing);
      const newVersionNumber = oldVersion.versionNumber + 1;
      const newVersionId = new OfferListingVersionId(id, newVersionNumber);
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersion.id,
      });
    }

    updateFunc(newVersion);

    await this.tx.offerListing.upsert(
      toUpsert(
        _.merge(offerListing, {
          currentVersionId: newVersion.id,
        })
      )
    );
    await this.tx.offerListingVersion.create({ data: newVersion });
  }

  async getCurrentOfferListVersion(idOrOfferListing: OfferListingId | prisma.OfferListing) {
    const id = "id" in idOrOfferListing ? idOrOfferListing.id : (idOrOfferListing as OfferListingId).value;
    const offerListing = await this.tx.offerListing.findUnique({where: {id: id}})
    if(!offerListing) {
      throw new Error(`Could not find offerListing form id: ${id}`)
    }
    const currentVersion = await this.tx.offerListingVersion.findUnique({
      where: { id: offerListing.currentVersionId },
    });
    if (currentVersion === null) {
      throw new Error(`Could not find Current offer listing version, id: ${currentVersion}`);
    }
    return currentVersion;
  }

  public async deleteLatestOfferListingVersion(id: OfferListingId) {
    const offerListing = await this.tx.offerListing.findUnique({
      where: { id: id.value },
    });
    if (offerListing === null)
      throw Error(`OfferListing not found - id: ${id.value}`);

    const offerListVersion = await this.tx.offerListingVersion.findUnique({
      where: { id: offerListing.currentVersionId },
    });
    
    if (offerListVersion!.prevVersionId === null) {
      await this.tx.offerListing.update({
        where: { id: id.value },
        data: { currentVersionId: ""},
      });
      await this.tx.offerListingVersion.delete({
        where: { id: offerListing.currentVersionId },
      });
      await this.tx.offerListing.delete({ where: { id: id.value } });
    } else {
      await this.tx.offerListing.update({
        where: { id: id.value },
        data: { currentVersionId: offerListVersion!.prevVersionId},
      });
      await this.tx.offerListingVersion.delete({
        where: { id: offerListing.currentVersionId },
      });
    }
  }
}
