import * as prisma from "@prisma/client";
import * as _ from "lodash";

import { MangroveOrder, TakenOffer } from "@prisma/client";
import {
  addNumberStrings,
  getNumber,
  getPrice
} from "../handlers/handlerUtils";
import {
  MangroveOrderId,
  MangroveOrderVersionId,
  OfferId
} from "../model";
import { DbOperations, PrismaTx, toUpsert } from "./dbOperations";
import { OfferListOperations } from "./offerListOperations";

export class MangroveOrderOperations extends DbOperations {
  private offerListOperations: OfferListOperations;
  public constructor(public readonly tx: PrismaTx) {
    super(tx);
    this.offerListOperations = new OfferListOperations(tx);
  }

  public async addMangroveOrderVersionFromOfferId(
    id: OfferId,
    updateFunc: (model: prisma.MangroveOrderVersion) => void
  ) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: id.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      const mangroveOrderVersion = await this.getCurrentMangroveOrderVersion({
        mangroveOrder,
      });
      updateFunc(mangroveOrderVersion);
      await this.addMangroveOrderVersion(
        new MangroveOrderId({ mangroveOrder: mangroveOrder }),
        mangroveOrder,
        mangroveOrderVersion
      );
    }
  }

  public async getCurrentMangroveOrderVersion(
    params:
      | { mangroveOrder: MangroveOrder }
      | { mangroveOrderId: MangroveOrderId }
  ) {
    const mangroveOrder = await this.tx.mangroveOrder.findUnique({
      where: {
        id:
          "mangroveOrder" in params
            ? params.mangroveOrder.id
            : params.mangroveOrderId.value,
      },
    });
    if (!mangroveOrder) {
      throw Error(`Could not find mangroveOrder from: ${params}`);
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

  // Add a new OfferVersion to a (possibly new) Offer
  public async addMangroveOrderVersion(
    id: MangroveOrderId,
    mangroveOrder: Omit<prisma.MangroveOrder, "currentVersionId">,
    version: Omit<
      prisma.MangroveOrderVersion,
      "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId"
    >
  ) {
    if (mangroveOrder.id != id.value) {
      throw new Error(
        `MangroveOrder.id (${mangroveOrder}) and Id (${id}) must be the same id `
      );
    }

    const oldMangroveOrder = await this.tx.mangroveOrder.findUnique({
      where: { id: id.value },
    });

    if (!oldMangroveOrder) {
      throw new Error(`The MangroveOrder does not exist ${id}`);
    }

    let oldVersion: prisma.MangroveOrderVersion | null = null;
    if (oldMangroveOrder.currentVersionId !== undefined) {
      oldVersion = await this.tx.mangroveOrderVersion.findUnique({
        where: { id: oldMangroveOrder.currentVersionId },
      });
      if (oldVersion === null) {
        throw new Error(
          `Old MangroveOrderVersion not found, id: ${oldVersion}`
        );
      }
    }

    const newVersionNumber =
      oldVersion === null ? 0 : oldVersion.versionNumber + 1;
    const newVersionId = new MangroveOrderVersionId({
      mangroveOrderId: id,
      versionNumber: newVersionNumber,
    });

    await this.tx.mangroveOrder.upsert(
      toUpsert<prisma.MangroveOrder>(
        _.merge(mangroveOrder, {
          currentVersionId: newVersionId.value,
        })
      )
    );

    await this.tx.mangroveOrderVersion.create({
      data: _.merge(version, {
        id: newVersionId.value,
        mangroveOrderId: mangroveOrder.id,
        versionNumber: newVersionNumber,
        prevVersionId: oldMangroveOrder.currentVersionId,
      }),
    });
  }

  public async deleteLatestMangroveOrderVersionUsingOfferId(id: OfferId) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: id.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      await this.deleteLatestVersionOfMangroveOrder(
        new MangroveOrderId({ mangroveOrder: mangroveOrder })
      );
    }
  }

  public async deleteLatestVersionOfMangroveOrder(id: MangroveOrderId) {
    const mangroveOrder = await this.tx.mangroveOrder.findUnique({
      where: { id: id.value },
    });
    if (mangroveOrder === null)
      throw Error(`MangroveOrder not found - id: ${id.value}`);

    const version = await this.tx.mangroveOrderVersion.findUnique({
      where: { id: mangroveOrder.currentVersionId },
    });
    await this.tx.mangroveOrderVersion.delete({
      where: { id: mangroveOrder.currentVersionId },
    });

    if (version!.prevVersionId != null) {
      // No need to handle 'null' scenario, this will never happen in a 'undo' of offerRetract
      mangroveOrder.currentVersionId = version!.prevVersionId;
      await this.tx.mangroveOrder.update({
        where: { id: id.value },
        data: mangroveOrder,
      });
    }
  }

  public async updateMangroveOrderFromTakenOffer(
    takenOffer: Omit<TakenOffer, "orderId" | "offerVersionId">,
    offerId: OfferId
  ) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: offerId.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      const newVersion = await this.getCurrentMangroveOrderVersion({
        mangroveOrder,
      });
      if (!newVersion) {
        continue;
      }
      const tokens = await this.offerListOperations.getOfferListTokens({
        mangroveOrder,
      });
      newVersion.failed = this.getFailed(takenOffer);
      newVersion.failedReason = this.getFailedReason(takenOffer);
      newVersion.takerGave = addNumberStrings({
        value1: newVersion.takerGave,
        value2: takenOffer.takerGave,
        token: tokens.inboundToken,
      });
      newVersion.takerGaveNumber = getNumber({
        value: newVersion.takerGave,
        token: tokens.inboundToken,
      });
      newVersion.takerGot = addNumberStrings({
        value1: newVersion.takerGot,
        value2: takenOffer.takerGot,
        token: tokens.outboundToken,
      });
      newVersion.takerGotNumber = getNumber({
        value: newVersion.takerGot,
        token: tokens.inboundToken,
      });
      newVersion.filled = this.getFilled(
        mangroveOrder,
        newVersion.takerGot,
        newVersion.takerGave,
        mangroveOrder.totalFee,
        tokens.outboundToken
      );
      newVersion.price = getPrice({ 
        over: newVersion.takerGaveNumber,
        under: newVersion.takerGotNumber }
      ) ?? 0;
      await this.addMangroveOrderVersion(
        new MangroveOrderId({ mangroveOrder: mangroveOrder }),
        mangroveOrder,
        newVersion
      );
    }
  }

  // strats

  public async createMangroveOrder(
    mangroveOrder: prisma.MangroveOrder
  ): Promise<prisma.MangroveOrder> {
    return await this.tx.mangroveOrder.create({ data: mangroveOrder });
  }

  public async deleteMangroveOrder(id: MangroveOrderId) {
    await this.tx.mangroveOrder.delete({ where: { id: id.value } });
  }

  public async createMangroveOrderVersion(
    mangroveOrderVersion: prisma.MangroveOrderVersion
  ): Promise<prisma.MangroveOrderVersion> {
    return await this.tx.mangroveOrderVersion.create({
      data: mangroveOrderVersion,
    });
  }

  //FIXME: add unit tests
  getFailedReason(
    o: Omit<prisma.TakenOffer, "orderId" | "offerVersionId">
  ): string | null {
    return o.failReason ? o.failReason : o.posthookData;
  }

  getFailed(o: Omit<prisma.TakenOffer, "orderId" | "offerVersionId">): boolean {
    return o.posthookFailed || o.posthookData != null;
  }

  getFilled(
    mangroveOrder: MangroveOrder,
    takerGot: string,
    takerGave: string,
    feeBefore: string,
    token: { decimals: number }
  ) {
    return mangroveOrder.fillWants
      ? addNumberStrings({
          value1: takerGot,
          value2: feeBefore,
          token: token,
        }) == mangroveOrder.takerWants
      : takerGave == mangroveOrder.takerGives;
  }
}
