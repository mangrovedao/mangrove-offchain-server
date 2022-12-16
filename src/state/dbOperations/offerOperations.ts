import * as prisma from "@prisma/client";
import { OfferId, OfferVersionId } from "../../state/model";
import { DbOperations, toUpsert } from "./dbOperations";
import * as _ from "lodash";

export class OfferOperations extends DbOperations {

  public async getOffer(id: OfferId): Promise<prisma.Offer | null> {
    return await this.tx.offer.findUnique({ where: { id: id.value } });
  }

  public async markOfferAsDeleted(id: OfferId) {
    const offer = await this.getOffer(id);
    if (!offer) {
      throw Error(`Could not find offer for offerId: ${id}`);
    }
    const newVersion = await this.tx.offerVersion.findUnique({
      where: { id: offer.currentVersionId },
    });
    if (!newVersion) {
      throw Error(`Could not find current offer version of offerId: ${id}`);
    }
    newVersion.deleted = true;
    await this.addVersionedOffer(id, offer, newVersion);
  }

  public async getVersionedOffer(offerVersionId: string) {
    return this.tx.offerVersion.findUnique({ where: { id: offerVersionId } });
  }

  // Add a new OfferVersion to a (possibly new) Offer
  public async addVersionedOffer(
    id: OfferId,
    offer: Omit<prisma.Offer, "currentVersionId">,
    version: Omit<
      prisma.OfferVersion,
      "id" | "offerId" | "versionNumber" | "prevVersionId"
    >
  ) {
    const oldVersionId = (await this.getOffer(id))?.currentVersionId;

    let oldVersion: prisma.OfferVersion | null = null;
    if (oldVersionId !== undefined) {
      oldVersion = await this.tx.offerVersion.findUnique({
        where: { id: oldVersionId },
      });
      if (oldVersion === null) {
        throw new Error(`Old OfferVersion not found, id: ${oldVersion}`);
      }
    }

    const newVersionNumber =
      oldVersion === null ? 0 : oldVersion.versionNumber + 1;
    const newVersionId = new OfferVersionId(id, newVersionNumber);

    await this.tx.offer.upsert(
      toUpsert<prisma.Offer>(
        _.merge(offer, {
          currentVersionId: newVersionId.value,
        })
      )
    );

    await this.tx.offerVersion.create({
      data: _.merge(version, {
        id: newVersionId.value,
        offerId: offer.id,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersionId,
      }),
    });
  }

  public async deleteLatestOfferVersion(id: OfferId) {
    const offer = await this.tx.offer.findUnique({ where: { id: id.value } });
    if (offer === null) throw Error(`Offer not found - id: ${id.value}`);

    const version = await this.tx.offerVersion.findUnique({
      where: { id: offer.currentVersionId },
    });
    if (version === null) throw Error(`OfferVersion not found - id: ${id.value}, currentVersionId: ${offer.currentVersionId}`);

    await this.tx.offerVersion.delete({
      where: { id: offer.currentVersionId },
    });

    if (version.prevVersionId === null) {
      await this.tx.offer.delete({ where: { id: id.value } });
    } else {
      offer.currentVersionId = version!.prevVersionId;
      await this.tx.offer.update({ where: { id: id.value }, data: offer });
    }
  }
}
