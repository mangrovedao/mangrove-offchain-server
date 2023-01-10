import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { allDbOperations } from "src/state/dbOperations/allDbOperations";

import { PrismaClient } from "@prisma/client";
import {
  PrismaStreamEventHandler,
  PrismaTransaction,
  TypedEvent,
} from "src/common";
import { createPatternMatcher } from "src/utils/discriminatedUnion";
import {
  ChainId,
  TransactionId
} from "src/state/model";
import { MangroveOrderEventsLogic } from "./mangroveOrderEventsLogic";
import { ChainConfig } from "src/utils/config/ChainConfig";
import config from "src/utils/config/config";
import { getChainConfigsOrThrow } from "src/utils/config/configUtils";
import logger from "src/utils/logger";

export class IOrderLogicEventHandler extends PrismaStreamEventHandler<mangroveSchema.strategyEvents.StrategyEvent> {
  private configs:ChainConfig | undefined;
  public constructor(
    prisma: PrismaClient,
    stream: string,
    private readonly chainId: ChainId
  ) {
    super(prisma, stream);
    this.configs = getChainConfigsOrThrow<ChainConfig>(config).find( value => value.id == chainId.value.toString());
  }

  mangroveOrderEventsLogic = new MangroveOrderEventsLogic();

  protected async handleParsedEvents(
    events: TypedEvent<mangroveSchema.strategyEvents.StrategyEvent>[],
    tx: PrismaTransaction
  ): Promise<void> {
    const allDbOperation = allDbOperations(tx);
    for (const event of events) {
      const { payload, undo, timestamp } = event;
      const chainId = new ChainId(payload.chainId);
      

      const txRef = payload.tx;
      const txId = new TransactionId(chainId, txRef.txHash);

      const transaction = await allDbOperation.transactionOperations.ensureTransaction({
        id: txId,
        txHash: txRef.txHash,
        from:  txRef.sender,
        timestamp: timestamp,
        blockNumber: txRef.blockNumber,
        blockHash: txRef.blockHash
    });

      await eventMatcher({
        LogIncident: async (e) => {},
        NewOwnedOffer: async (e) => {},
        OrderSummary: async (e) => {
          if( this.configs && this.configs.excludeMangroves && this.configs.excludeMangroves.find( value => e.mangroveId.includes( value.toLowerCase().substring(0, 6) ) ) ){
            // logger.info(`Skipping event: ${JSON.stringify(event)}, because of mangroveId: ${e.mangroveId}`)
            return;
          }
          await this.mangroveOrderEventsLogic.handleOrderSummary(allDbOperation, chainId, e, event, txRef.txHash, undo, transaction)
        },
        SetExpiry: async (e) => {
          await this.mangroveOrderEventsLogic.handleSetExpiry(allDbOperation, chainId, transaction.id, e )
        }
      })(payload);
    }
  }

  protected deserialize(
    payload: Buffer
  ): mangroveSchema.strategyEvents.StrategyEvent {
    return mangroveSchema.streams.strategies.serdes.deserialize(payload);
  }
}

const eventMatcher =
  createPatternMatcher<mangroveSchema.strategyEvents.StrategyEvent>();
