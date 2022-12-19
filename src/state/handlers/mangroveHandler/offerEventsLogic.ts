import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import BigNumber from "bignumber.js";
import { AllDbOperations } from "state/dbOperations/allDbOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListId,
  OrderId,
} from "../../model";

export class OfferEventsLogic {
  async handleOfferRetracted(
    mangroveId: MangroveId,
    undo: boolean,
    e: mangroveSchema.events.OfferRetracted,
    db: AllDbOperations
  ) {
    const offerId = new OfferId(mangroveId, e.offerList, e.offerId);
    if (undo) {
      await db.offerOperations.deleteLatestOfferVersion(offerId);
      await db.mangroveOrderOperations.deleteLatestMangroveOrderVersionUsingOfferId(
        offerId
      );
      return;
    }
    await db.mangroveOrderOperations.addMangroveOrderVersionFromOfferId(
      offerId,
      (m) => (m.cancelled = true)
    );
    await db.offerOperations.markOfferAsDeleted(offerId);
  }

  async handleOfferWritten(
    txRef: any,
    undo: boolean,
    chainId: ChainId,
    mangroveId: MangroveId,
    offerList: mangroveSchema.core.OfferList,
    maker: string,
    offer: mangroveSchema.core.Offer,
    transaction: prisma.Transaction | undefined,
    db: AllDbOperations,
    parentOrderId: OrderId | undefined
  ) {
    assert(txRef);
    const offerId = new OfferId(mangroveId, offerList, offer.id);

    if (undo) {
      await db.offerOperations.deleteLatestOfferVersion(offerId);
      return;
    }

    const accountId = new AccountId(chainId, maker);
    await db.accountOperations.ensureAccount(accountId);

    const offerListId = new OfferListId(mangroveId, offerList);

    const prevOfferId = 
      offer.prev == 0 ? null : new OfferId(mangroveId, offerList, offer.prev);

    const { outboundToken, inboundToken } =
      await db.offerListOperations.getOfferListTokens({
        id: offerListId,
      });
    const givesBigNumber = new BigNumber(offer.gives).shiftedBy(
      -outboundToken.decimals
    );
    const wantsBigNumber = new BigNumber(offer.wants).shiftedBy(
      -inboundToken.decimals
    );

    await db.offerOperations.addVersionedOffer(
      offerId,
      {
        id: offerId.value,
        mangroveId: mangroveId.value,
        offerListId: offerListId.value,
        makerId: maker,
      },
      {
        txId: transaction!.id,
        parentOrderId: parentOrderId?.value ?? null,
        deleted: false,
        gasprice: offer.gasprice,
        gives: offer.gives,
        givesNumber: givesBigNumber.toNumber(),
        wants: offer.wants,
        wantsNumber: wantsBigNumber.toNumber(),
        takerPaysPrice: givesBigNumber.gt(0)
          ? wantsBigNumber.div(givesBigNumber).toNumber()
          : null,
        makerPaysPrice: wantsBigNumber.gt(0)
          ? givesBigNumber.div(wantsBigNumber).toNumber()
          : null,
        gasreq: offer.gasreq,
        live: new BigNumber(offer.gives).isPositive(),
        deprovisioned: offer.gasprice == 0,
        prevOfferId: prevOfferId ? prevOfferId.value : null,
      }
    );
  }
}
