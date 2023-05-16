import { PrismaClient } from "@prisma/client";
import {
  PrismaStreamEventHandler,
  PrismaTransaction,
  TypedEvent,
} from "src/utils/common";
import { AllDbOperations, allDbOperations } from "src/state/dbOperations/allDbOperations";
import {
  ChainId,
  KandelId,
  TransactionId
} from "src/state/model";
// import {KandelEvent, SeederEvent} from "@proximaone/stream-schema-mangrove/dist/kandel"
import { createPatternMatcher } from "src/utils/discriminatedUnion";
import { KandelEventsLogic } from "./kandelEventsLogic";
import * as kandel from "@proximaone/stream-schema-mangrove/dist/kandel";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { sleep } from "@mangrovedao/commonlib.js";
import { Timestamp } from "@proximaone/stream-client-js";
import { async } from "rxjs";

export class IKandelLogicEventHandler extends PrismaStreamEventHandler<kandel.KandelEvent | kandel.SeederEvent > {
  public constructor(
    prisma: PrismaClient,
    stream: string,
    private readonly chainId: ChainId
  ) {
    super(prisma, stream);
  }

  protected async handleParsedEvents(
    events: TypedEvent<kandel.KandelEvent | kandel.SeederEvent >[],
    tx: PrismaTransaction
  ): Promise<void> {
    const allDbOperation = allDbOperations(tx);
    const kandelEventsLogic = new KandelEventsLogic(allDbOperation, this.stream);
    for (const event of events) {
      const { payload, undo, timestamp } = event;
      
      const chainId = new ChainId(payload.chainId);
      
      const txRef = payload.tx;
      const txId = new TransactionId(chainId, txRef.txHash);

      await waitForTimestamp(allDbOperation, timestamp);
      const transaction = await allDbOperation.transactionOperations.ensureTransaction({
        id: txId,
        txHash: txRef.txHash,
        from:  txRef.sender,
        timestamp: timestamp,
        blockNumber: txRef.blockNumber,
        blockHash: txRef.blockHash
    });
      await eventMatcher({
        NewKandel: async (e) => {
          await kandelEventsLogic.handleKandelCreated(undo, chainId, e, transaction)
        },
        NewAaveKandel: async (e) => {
          await kandelEventsLogic.handleKandelCreated(undo, chainId, e, transaction)
        },
        SetParams: async (e) => {
          await kandelEventsLogic.handleKandelParamsUpdated(undo, new KandelId(chainId, payload.address), e, transaction);
        },
        Debit: async (e) => {
          await kandelEventsLogic.handleDepositWithdrawal(undo, new KandelId(chainId, payload.address), e, transaction)
        },
        Credit: async (e) => {
          await kandelEventsLogic.handleDepositWithdrawal(undo, new KandelId(chainId, payload.address), e, transaction)
        },
        Populate: async (e) => {
          await kandelEventsLogic.handlePopulate(undo, new KandelId(chainId, payload.address), e, transaction);
        },
        Retract: async (e) => {
          await kandelEventsLogic.handelRetractOffers(undo, new KandelId(chainId, payload.address), e, transaction);
        },
        SetIndexMapping: async (e) => {
          await kandelEventsLogic.handleOfferIndex(undo, new KandelId(chainId, payload.address), e, transaction);
        }
      })(payload);
    }
  }

  protected deserialize( 
    payload: Buffer
  ): kandel.KandelEvent | kandel.SeederEvent {
    return mangroveSchema.streams.kandel.serdes.deserialize(payload);
  }
}

const eventMatcher =
  createPatternMatcher<kandel.KandelEvent | kandel.SeederEvent >();

async function waitForTimestamp(allDbOperation: AllDbOperations, timestamp:Timestamp) {
  let isReady = false;
  while (!isReady) {
    isReady = await allDbOperation.transactionOperations.hasTransactionWithHigherTimestamp(timestamp);
    if (!isReady) {
      await sleep(1000);
    }
  }
}

