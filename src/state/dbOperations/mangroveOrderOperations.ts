import * as prisma from "@prisma/client";
import * as _ from "lodash";

import {
    MangroveOrder,
    TakenOffer
} from "@prisma/client";
import { Timestamp } from "@proximaone/stream-client-js";
import BigNumber from "bignumber.js";
import {
    addNumberStrings, getNumber,
    getPrice
} from "../handlerUtils";
import {
    ChainId, MangroveId, MangroveOrderId,
    MangroveOrderVersionId, OfferId
} from "../model";
import { DbOperations, PrismaTx, toUpsert } from "./dbOperations";
import { OfferListOperations } from "./offerListOperations";

export class MangroveOrderOperations extends DbOperations {

    private offerListOperations:OfferListOperations;
    public constructor(protected readonly tx: PrismaTx) {
        super(tx);
        this.offerListOperations = new OfferListOperations(tx);

    }

    public async markMangroveOrderVersionAsCancelled(id: OfferId) {
        const mangroveOrders = await this.tx.mangroveOrder.findMany({
          where: { restingOrderId: id.value },
        });
        for (const mangroveOrder of mangroveOrders) {
          const mangroveOrderVersion = await this.getCurrentMangroveOrderVersion(
            mangroveOrder
          );
          mangroveOrderVersion.cancelled = true;
          this.addMangroveOrderVersion(
            new MangroveOrderId({ mangroveOrder: mangroveOrder }),
            mangroveOrder,
            mangroveOrderVersion
          );
        }
      }
    
      public async getCurrentMangroveOrderVersion(mangroveOrder: MangroveOrder) {
        const version = await this.tx.mangroveOrderVersion.findUnique({
          where: {
            id: new MangroveOrderVersionId({
              mangroveOrder: mangroveOrder,
              versionNumber: Number(mangroveOrder.currentVersionId),
            }).value,
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
    const oldVersionId = (
      await this.tx.mangroveOrder.findUnique({ where: { id: id.value } })
    )?.currentVersionId;

    let oldVersion: prisma.MangroveOrderVersion | null = null;
    if (oldVersionId !== undefined) {
      oldVersion = await this.tx.mangroveOrderVersion.findUnique({
        where: { id: oldVersionId },
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
        prevVersionId: oldVersionId,
      }),
    });
  }

  public async deleteLatestMangroveOrderVersionUsingOfferId(id: OfferId) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: id.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      this.deleteLatestVersionOfMangroveOrder(
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
    o: Omit<TakenOffer, "orderId" | "offerVersionId">,
    offerId: OfferId
  ) {
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { restingOrderId: offerId.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      const newVersion = await this.getCurrentMangroveOrderVersion(
        mangroveOrder
      );
      if (newVersion) {
        const tokens = await this.offerListOperations.getInboundOutboundTokensFromOfferList(
          mangroveOrder.offerListId
        );
        const feeBefore = newVersion.totalFee;
        const feeForThisOffer = await this.offerListOperations.feeForThisOffer(
          mangroveOrder.offerListId,
          o.takerGot
        );
        const newTotalFee = addNumberStrings({
          value1: feeBefore,
          value2: feeForThisOffer.toFixed(),
          token: tokens.outboundToken,
        });
        newVersion.totalFee = newTotalFee;
        newVersion.totalFeeNumber = new BigNumber(newTotalFee).toNumber();
        newVersion.failed = o.posthookFailed || o.posthookData != null;
        newVersion.failedReason = o.failReason ? o.failReason : o.posthookData;
        newVersion.takerGave = addNumberStrings({
          value1: newVersion.takerGave,
          value2: o.takerGave,
          token: tokens.inboundToken,
        });
        newVersion.takerGaveNumber = getNumber({
          value: newVersion.takerGave,
          token: tokens.inboundToken,
        });
        newVersion.takerGot = addNumberStrings({
          value1: newVersion.takerGot,
          value2: o.takerGot,
          token: tokens.outboundToken,
        });
        newVersion.takerGotNumber = getNumber({
          value: newVersion.takerGot,
          token: tokens.inboundToken,
        });
        newVersion.filled = mangroveOrder.fillWants
          ? addNumberStrings({
              value1: newVersion.takerGot,
              value2: feeBefore,
              token: tokens.outboundToken,
            }) == mangroveOrder.takerWants
          : newVersion.takerGave == mangroveOrder.takerGives;
        newVersion.price = getPrice(
          newVersion.takerGaveNumber,
          newVersion.takerGotNumber
        );
        this.addMangroveOrderVersion(
          new MangroveOrderId({ mangroveOrder: mangroveOrder }),
          mangroveOrder,
          newVersion
        );
      }
    }
  }

  async updateMangroveOrderWithExpiry(
    chainId: ChainId,
    params: {
      mangroveId: string;
      offerId: number;
      expiry: Timestamp["date"];
      outboundToken: string;
      inboundToken: string;
    }
  ) {
    const offer = new OfferId(
      new MangroveId(chainId, params.mangroveId),
      {
        inboundToken: params.inboundToken,
        outboundToken: params.outboundToken,
      },
      params.offerId
    );
    const mangroveOrders = await this.tx.mangroveOrder.findMany({
      where: { mangroveId: params.mangroveId, restingOrderId: offer.value },
    });
    for (const mangroveOrder of mangroveOrders) {
      const newVersion = await this.getCurrentMangroveOrderVersion(
        mangroveOrder
      );
      newVersion.expiryDate = params.expiry;
      this.addMangroveOrderVersion(
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
        this.tx.mangroveOrder.delete({ where: { id: id.value } });
      }
    
      public async createMangroveOrderVersion(
        mangroveOrderVersion: prisma.MangroveOrderVersion
      ): Promise<prisma.MangroveOrderVersion> {
        return await this.tx.mangroveOrderVersion.create({
          data: mangroveOrderVersion,
        });
      }
}