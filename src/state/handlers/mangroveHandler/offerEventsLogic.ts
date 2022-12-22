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
import { initial } from "lodash";

export class OfferEventsLogic {
  async handleOfferRetracted(
    mangroveId: MangroveId,
    undo: boolean,
    e: mangroveSchema.events.OfferRetracted,
    db: AllDbOperations,
    txId: string,
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
      txId,
      (m) => (m.cancelled = true)
    );
    await db.offerOperations.addVersionedOffer(offerId, txId, (m) => m.deleted =true);
  }

  async handleOfferWritten(
    txRef: any,
    undo: boolean,
    chainId: ChainId,
    mangroveId: MangroveId,
    offerList: mangroveSchema.core.OfferList,
    maker: string,
    offer: mangroveSchema.core.Offer,
    transaction: prisma.Transaction,
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

    let updateFunc = (offerVersion: Omit< prisma.OfferVersion, "id" | "offerId" | "versionNumber" | "prevVersionId" >) => {
      offerVersion.txId= transaction!.id;
      offerVersion.parentOrderId= parentOrderId?.value ?? null;
      offerVersion.deleted= false;
      offerVersion.gasprice= offer.gasprice;
      offerVersion.gives= offer.gives;
      offerVersion.givesNumber= givesBigNumber.toNumber();
      offerVersion.wants= offer.wants;
      offerVersion.wantsNumber= wantsBigNumber.toNumber();
      offerVersion.takerPaysPrice= givesBigNumber.gt(0)
        ? wantsBigNumber.div(givesBigNumber).toNumber()
        : null;
      offerVersion.makerPaysPrice= wantsBigNumber.gt(0)
        ? givesBigNumber.div(wantsBigNumber).toNumber()
        : null;
      offerVersion.gasreq= offer.gasreq;
      offerVersion.live= new BigNumber(offer.gives).isPositive();
      offerVersion.deprovisioned= offer.gasprice == 0;
      offerVersion.prevOfferId= prevOfferId ? prevOfferId.value : null;
    };

    await db.offerOperations.addVersionedOffer(
      offerId,
      transaction?.id,
      updateFunc,
      {
        makerId: accountId,
        parentOrderId
      }
    );
  }
}
