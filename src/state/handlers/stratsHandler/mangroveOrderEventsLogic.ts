import { MangroveOrderVersion, TakenOffer, Transaction } from ".prisma/client";
import { OrderSummary, SetExpiry } from "@proximaone/stream-schema-mangrove/dist/strategyEvents";
import { AllDbOperations } from "src/state/dbOperations/allDbOperations";
import { addNumberStrings, fromBigNumber, getPrice } from "src/utils/numberUtils";
import {
  AccountId,
  ChainId,
  MangroveId,
  MangroveOrderId,
  OfferId,
  OfferListingId,
  OrderId,
  TokenId
} from "src/state/model";
import logger from "src/utils/logger";
import { EventsLogic } from "../eventsLogic";



export class MangroveOrderEventsLogic extends EventsLogic {


  async handleSetExpiry(
    db: AllDbOperations,
    chainId: ChainId,
    txId: string,
    event: SetExpiry & { address: string },
  ) {

    const stratId = new AccountId(chainId, event.address);
    const mangroveId = await db.mangroveOrderOperations.getMangroveIdByStratId(stratId);
    if (!mangroveId) {
      logger.info(`MangroveOrder strat not yet created, address: ${stratId.value}`)
      return;
    }
    const offerListKey = {
      inboundToken: event.outboundToken,
      outboundToken: event.inboundToken,
    };
    const offerId = new OfferId(mangroveId, offerListKey, event.offerId);

    const mangroveOrderVersion = await db.mangroveOrderOperations.addMangroveOrderVersionFromOfferId(
      offerId,
      txId,
      (m) => (m.expiryDate = new Date(event.date))
    );
    if( mangroveOrderVersion)
      await db.mangroveOrderOperations.createMangroveOrderSetExpiryDateEvent({mangroveOrderVersion,event });
  }

  async handleOrderSummary(
    db: AllDbOperations,
    chainId: ChainId,
    e: OrderSummary & { id: string; address: string },
    undo: boolean,
    transaction: Transaction
  ) {
    const offerList = this.getOfferListFromOrderSummary(e);
    await db.tokenOperations.assertTokenExists(
      new TokenId(chainId, offerList.outboundToken)
    );
    await db.tokenOperations.assertTokenExists(
      new TokenId(chainId, offerList.inboundToken)
    );
    const mangroveId = new MangroveId(chainId, e.mangroveId);
    const offerListingId = new OfferListingId(mangroveId, offerList);
    const mangroveOrderId = new MangroveOrderId(
      mangroveId,
      offerList,
      e.id,
    );

    if (undo) {
      await db.mangroveOrderOperations.deleteLatestVersionOfMangroveOrder(mangroveOrderId);
      return;
    }

    const { outboundToken, inboundToken } = await db.offerListOperations.getOfferListTokens({
      id: offerListingId
    });
    const initialVersionFunc = (version: Omit<MangroveOrderVersion, "id" | "mangroveOrderId" | "versionNumber" | "prevVersionId">) => {
      version.expiryDate = new Date(e.expiryDate * 1000);
    }
    const restingOrderId = e.restingOrderId != 0 ? new OfferId(mangroveId, {outboundToken:offerList.inboundToken, inboundToken: offerList.outboundToken}, e.restingOrderId).value : null

    await db.mangroveOrderOperations.addMangroveOrderVersion(mangroveOrderId, transaction.id, initialVersionFunc, {
      orderId: new OrderId(mangroveId, offerList, e.orderId).value,
      takerId: new AccountId(chainId, e.taker).value,
      stratId: new AccountId(chainId, e.address).value,
      fillOrKill: e.fillOrKill.valueOf(),
      fillWants: e.fillWants.valueOf(),
      restingOrder: e.restingOrder.valueOf(),
      takerWants: e.takerWants,
      takerWantsNumber: fromBigNumber({
        value: e.takerWants,
        token: outboundToken,
      }),
      takerGives: e.takerGives,
      takerGivesNumber: fromBigNumber({
        value: e.takerGives,
        token: inboundToken,
      }),
      bounty: e.bounty,
      bountyNumber: fromBigNumber({ value: e.bounty, decimals: 18 }),
      totalFee: e.fee,
      totalFeeNumber: fromBigNumber({ value: e.fee, token: outboundToken }),
      restingOrderId: e.restingOrderId != 0 ? new OfferId(mangroveId, {outboundToken:offerList.inboundToken, inboundToken: offerList.outboundToken}, e.restingOrderId).value : null,
      hasRestingOrder: e.restingOrderId ? true : false,
    });

  }

  getOfferListFromOrderSummary(e:{ fillWants: boolean, outboundToken: string, inboundToken: string }) {
    return {
      outboundToken: e.outboundToken,
      inboundToken: e.inboundToken,
    };
  }
}
