import * as prisma from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import _ from "lodash";
import {
  PrismaStreamEventHandler,
  PrismaTransaction,
  TypedEvent,
} from "src/common";
import { allDbOperations } from "src/state/dbOperations/allDbOperations";
import {
  ChainId,
  MangroveId,
  OrderId,
  TransactionId
} from "src/state/model";
import { createPatternMatcher } from "src/utils/discriminatedUnion";
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
      let transaction: prisma.Transaction;
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
        MangroveCreated: async (e) =>{
          if (undo) {
            await allDbOperation.mangroveOperation.deleteLatestMangroveVersion(mangroveId);
            return;
          }
          await allDbOperation.mangroveOperation.addVersionedMangrove({ id:mangroveId, txId: transaction!.id, address: e.address });
        }
        ,
        MangroveParamsUpdated: async ({ params }) =>{
          if (undo) {
            await allDbOperation.mangroveOperation.deleteLatestMangroveVersion(mangroveId);
            return;
          }
      
          await allDbOperation.mangroveOperation.addVersionedMangrove({
            id: mangroveId,
            txId: transaction!.id,
            updateFunc: (model) => {
              _.merge(model, params);
            },
          });
        },
        OfferRetracted: async (e) =>
          this.offerEventsLogic.handleOfferRetracted(mangroveId, undo, e, allDbOperation, transaction!.id),
        OfferWritten: async ({ offer, maker, offerList }) =>
          await this.offerEventsLogic.handleOfferWritten(
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
          await this.mangroveEventsLogic.handleOfferListParamsUpdated(
            this.chainId,
            offerList,
            mangroveId,
            undo,
            params,
            allDbOperation,
            transaction
          ),
        MakerBalanceUpdated: async ({ maker, amountChange }) =>
          await this.mangroveEventsLogic.handleMakerBalanceUpdated(
            mangroveId,
            maker,
            undo,
            amountChange,
            allDbOperation.makerBalanceOperations,
            transaction
          ),
        TakerApprovalUpdated: async ({ offerList, amount, spender, owner }) =>
           await this.mangroveEventsLogic.handleTakerApprovalUpdated(
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
          await this.orderEventLogic.handleOrderCompleted(
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
