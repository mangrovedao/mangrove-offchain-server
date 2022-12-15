import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import BigNumber from "bignumber.js";
import { AllDbOperations } from "state/dbOperations/allDbOperations";
import { getBigNumber, getNumber } from "state/handlerUtils";
import {
    PrismaTransaction
} from "../../common";
import {
    AccountId,
    ChainId, MangroveId,
    OfferId,
    OfferListId, OrderId,
    TakenOfferId
} from "../model";

export class OrderEventLogic {

    async handleOrderCompleted(
        txRef: any,
        order: mangroveSchema.core.Order,
        offerList: mangroveSchema.core.OfferList,
        id: string,
        undo: boolean,
        mangroveId: MangroveId,
        chainId: ChainId,
        transaction: prisma.Transaction | undefined,
        db: AllDbOperations,
        parentOrderId: OrderId | undefined,
        tx: PrismaTransaction
      ) {
        assert(txRef);
        const orderId = new OrderId(mangroveId, offerList, id);
    
        if (undo) {
          await db.orderOperations.deleteOrder(orderId);
          for (const takenOffer of order.takenOffers) {
            await db.offerOperations.deleteLatestOfferVersion(
              new OfferId(mangroveId, offerList, takenOffer.id)
            );
          }
          return;
        }
    
        const offerListId = new OfferListId(mangroveId, offerList);
    
        const { outboundToken, inboundToken } = await db.offerListOperations.getOfferListTokens({
          id:offerListId
        }
        );
        const takerGotBigNumber = getBigNumber({
          value: order.takerGot,
          token: outboundToken,
        });
        const takerGaveBigNumber = getBigNumber({
          value: order.takerGave,
          token: inboundToken,
        });
    
    
    
        // create order and taken offers
        // taken offer is not an aggregate
    
        const takerAccountId = new AccountId(chainId, order.taker);
        await db.accountOperations.ensureAccount(takerAccountId);
        await tx.order.create({
          data: {
            id: orderId.value,
            txId: transaction!.id,
            parentOrderId: parentOrderId?.value ?? null,
            offerListId: offerListId.value,
            mangroveId: mangroveId.value,
            takerId: takerAccountId.value,
            takerWants: order.takerWants,
            takerWantsNumber: getNumber({
              value: order.takerWants,
              token: outboundToken,
            }),
            takerGives: order.takerGives,
            takerGivesNumber: getNumber({
              value: order.takerGives,
              token: inboundToken,
            }),
            takerGot: order.takerGot,
            takerGotNumber: takerGotBigNumber.toNumber(),
            takerGave: order.takerGave,
            takerGaveNumber: takerGaveBigNumber.toNumber(),
            takerPaidPrice: takerGotBigNumber.gt(0)
              ? takerGaveBigNumber.div(takerGotBigNumber).toNumber()
              : undefined,
            makerPaidPrice: takerGaveBigNumber.gt(0)
              ? takerGotBigNumber.div(takerGaveBigNumber).toNumber()
              : undefined,
            bounty: order.bounty,
            bountyNumber: getNumber({ value: order.bounty, decimals: 18 }), // TODO: Use decimals of the chain
            totalFee: order.feePaid,
            totalFeeNumber: getNumber({
              value: order.feePaid,
              token: outboundToken,
            }),
            takenOffers: {
              create: await Promise.all(
                order.takenOffers.map((o) =>
                  this.mapTakenOffer(orderId, o, inboundToken, outboundToken, db)
                )
              ),
            },
          },
        });
      }
    
      async mapTakenOffer(
        orderId: OrderId,
        o: mangroveSchema.core.TakenOffer,
        inboundToken: prisma.Token,
        outboundToken: prisma.Token,
        db: AllDbOperations
      ) {
        const takerGotBigNumber = new BigNumber(o.takerGot).shiftedBy(
          -outboundToken.decimals
        );
        const takerGaveBigNumber = new BigNumber(o.takerGave).shiftedBy(
          -inboundToken.decimals
        );
        const offerId = new OfferId(orderId.mangroveId, orderId.offerListKey, o.id);
        const offer = await db.offerOperations.getOffer(offerId);
    
        const takenOffer = {
          id: new TakenOfferId(orderId, o.id).value,
          offerVersion: {
            connect: { id: offer?.currentVersionId },
          },
          takerGot: o.takerGot,
          takerGotNumber: takerGotBigNumber.toNumber(),
          takerGave: o.takerGave,
          takerGaveNumber: takerGaveBigNumber.toNumber(),
          takerPaidPrice: takerGotBigNumber.gt(0)
            ? takerGaveBigNumber.div(takerGotBigNumber).toNumber()
            : null,
          makerPaidPrice: takerGaveBigNumber.gt(0)
            ? takerGotBigNumber.div(takerGaveBigNumber).toNumber()
            : null,
          failReason: o.failReason ? o.failReason : null,
          posthookData: o.posthookData ? o.posthookData : null,
          posthookFailed: o.posthookFailed == true,
        };
    
        // Taken offers have been removed from the book. Any offers that are reposted
        // will result in `OfferWritten` events that will be sent _after_ the
        // `OrderCompleted` event. We therefore remove all taken offers here.
        await db.offerOperations.markOfferAsDeleted(offerId);
        await db.mangroveOrderOperations.updateMangroveOrderFromTakenOffer(takenOffer, offerId);
        return takenOffer;
      }
}