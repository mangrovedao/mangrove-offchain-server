import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import BigNumber from "bignumber.js";
import { AllDbOperations } from "src/state/dbOperations/allDbOperations";
import {
  AccountId,
  ChainId,
  MangroveId,
  OfferId,
  OfferListingId,
  OfferListKey,
  OrderId,
} from "src/state/model";
import { getBigNumber, getPrice } from "src/state/handlers/handlerUtils";

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
    await db.offerOperations.addVersionedOffer(offerId, txId, (m) => m.deleted = true);
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
    const tokens = await db.offerListOperations.getOfferListTokens({
      id: new OfferListingId(mangroveId, offerList),
    });

    await db.offerOperations.addVersionedOffer(
      offerId,
      transaction?.id,
      (v) => this.offerWrittenFunc(v, offer, mangroveId, tokens, transaction!.id, parentOrderId),
      {
        makerId: accountId
      }
    );
  }

  async offerWrittenFunc(
    offerVersion: Omit<prisma.OfferVersion, "id" | "offerId" | "versionNumber" | "prevVersionId">,
    offer: mangroveSchema.core.Offer,
    mangroveId: MangroveId,
    tokens: { inboundToken: {address:string, decimals: number}, outboundToken: {address:string, decimals: number} },
    txId: string,
    parentOrderId?: OrderId) {
    const givesBigNumber = getBigNumber({ value: offer.gives, token: tokens.outboundToken });
    const wantsBigNumber = getBigNumber({ value: offer.wants, token: tokens.inboundToken });
    offerVersion.txId = txId;
    offerVersion.parentOrderId = parentOrderId?.value ?? null;
    offerVersion.deleted = false;
    offerVersion.gasprice = offer.gasprice;
    offerVersion.gives = offer.gives;
    offerVersion.givesNumber = givesBigNumber.toNumber();
    offerVersion.wants = offer.wants;
    offerVersion.wantsNumber = wantsBigNumber.toNumber();
    offerVersion.takerPaysPrice = getPrice({ over: wantsBigNumber, under: givesBigNumber });
    offerVersion.makerPaysPrice = getPrice({ over: givesBigNumber, under: wantsBigNumber });
    offerVersion.gasreq = offer.gasreq;
    offerVersion.live = new BigNumber(offer.gives).isPositive();
    offerVersion.deprovisioned = this.getDeprovisioned(offer);
    offerVersion.prevOfferId = this.getPrevOfferId(offer, mangroveId, tokens);
  };

  getPrevOfferId(offer: {prev: number}, mangroveId: MangroveId, tokens: { inboundToken: {address:string}, outboundToken: {address:string} }): string | null {
    const offerListKey: OfferListKey = { inboundToken: tokens.inboundToken.address, outboundToken: tokens.outboundToken.address };
    return offer.prev == 0 ? null : new OfferId(mangroveId, offerListKey, offer.prev).value;
  }

  getDeprovisioned(offer: {gasprice:number}): boolean {
    return offer.gasprice == 0;
  }
}
