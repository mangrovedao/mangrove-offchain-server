import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { PrismaClient } from "@prisma/client";
import {
  PrismaStreamEventHandler,
  PrismaTransaction,
  TypedEvent,
} from "../../../common";
import { createPatternMatcher } from "../../../utils/discriminatedUnion";
import { allDbOperations } from "../../dbOperations/allDbOperations";
import {
  ChainId,
  MangroveId,
  OrderId,
  TransactionId
} from "../../model";
import { MangroveEventsLogic } from "./mangroveEventsLogic";
import { OfferEventsLogic } from "./offerEventsLogic";
import { OrderEventLogic } from "./orderEventsLogic";

export class MangroveEventHandler extends PrismaStreamEventHandler<mangroveSchema.events.MangroveEvent> {
  public constructor(
    prisma: PrismaClient,
    stream: string,
    private readonly chainId: ChainId
  ) {
    super(prisma, stream);
  }
  mangroveEventsLogic = new MangroveEventsLogic();
  offerEventsLogic = new OfferEventsLogic();
  orderEventLogic = new OrderEventLogic();
  
  protected async handleParsedEvents(
    events: TypedEvent<mangroveSchema.events.MangroveEvent>[],
    tx: PrismaTransaction
  ): Promise<void> {
    const allDbOperation = allDbOperations(tx);
    for (const event of events) {
      const { payload, undo, timestamp } = event;
      const mangroveId = new MangroveId(this.chainId, payload.mangroveId!);
      const parentOrderId =
        payload.parentOrder === undefined
          ? undefined
          : new OrderId(
              mangroveId,
              payload.parentOrder.offerList,
              payload.parentOrder.id
            );
      const txRef = payload.tx;
      
      let transaction: prisma.Transaction | undefined;
      if (txRef !== undefined) {
        const txId = new TransactionId(this.chainId, txRef.txHash);
        transaction = await allDbOperation.transactionOperations.ensureTransaction({
          id: txId,
          txHash: txRef.txHash,
          from:  txRef.sender,
          timestamp: timestamp,
          blockNumber: txRef.blockNumber,
          blockHash: txRef.blockHash
      });
      }

      await eventMatcher({
        MangroveCreated: async (e) =>
          this.mangroveEventsLogic.handleMangroveCreated(
            undo,
            mangroveId,
            this.chainId,
            transaction,
            allDbOperation.mangroveOperation,
            e
          ),
        MangroveParamsUpdated: async ({ params }) =>
          this.mangroveEventsLogic.handleMangroveParamsUpdated(
            undo,
            mangroveId,
            params,
            transaction,
            allDbOperation.mangroveOperation
          ),
        OfferRetracted: async (e) =>
          this.offerEventsLogic.handleOfferRetracted(mangroveId, undo, e, allDbOperation),
        OfferWritten: async ({ offer, maker, offerList }) =>
          this.offerEventsLogic.handleOfferWritten(
            txRef,
            undo,
            this.chainId,
            mangroveId,
            offerList,
            maker,
            offer,
            transaction,
            allDbOperation,
            parentOrderId
          ),
        OfferListParamsUpdated: async ({ offerList, params }) =>
          this.mangroveEventsLogic.handleOfferListParamsUpdated(
            this.chainId,
            offerList,
            mangroveId,
            undo,
            params,
            allDbOperation,
            transaction
          ),
        MakerBalanceUpdated: async ({ maker, amountChange }) =>
          this.mangroveEventsLogic.handleMakerBalanceUpdated(
            mangroveId,
            maker,
            undo,
            amountChange,
            allDbOperation.makerBalanceOperations,
            transaction
          ),
        TakerApprovalUpdated: async ({ offerList, amount, spender, owner }) =>
          this.mangroveEventsLogic.handleTakerApprovalUpdated(
            mangroveId,
            offerList,
            owner,
            spender,
            undo,
            this.chainId,
            amount,
            parentOrderId,
            transaction,
            allDbOperation
          ),
        OrderCompleted: async ({ id, order, offerList }) =>
          this.orderEventLogic.handleOrderCompleted(
            txRef,
            order,
            offerList,
            id,
            undo,
            mangroveId,
            this.chainId,
            transaction,
            allDbOperation,
            parentOrderId,
            tx
          ),
      })(payload);
    }
  }

  protected deserialize(payload: Buffer): mangroveSchema.events.MangroveEvent {
    return mangroveSchema.streams.mangrove.serdes.deserialize(payload);
  }

}

const eventMatcher =
  createPatternMatcher<mangroveSchema.events.MangroveEvent>();
