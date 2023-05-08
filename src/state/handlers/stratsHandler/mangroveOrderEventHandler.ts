import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import { allDbOperations } from "src/state/dbOperations/allDbOperations";

import { PrismaClient } from "@prisma/client";
import {
  PrismaStreamEventHandler,
  PrismaTransaction,
  TypedEvent,
} from "src/utils/common";
import {
  ChainId,
  TransactionId
} from "src/state/model";
import { createPatternMatcher } from "src/utils/discriminatedUnion";
import { MangroveOrderEventsLogic } from "./mangroveOrderEventsLogic";
import { getChainConfigsOrThrow } from "src/utils/config/configUtils";
import { ChainConfig } from "src/utils/config/ChainConfig";
import config from "src/utils/config/config";


export class IOrderLogicEventHandler extends PrismaStreamEventHandler<mangroveSchema.strategyEvents.StrategyEvent> {
  public constructor(
    prisma: PrismaClient,
    stream: string,
    private readonly chainId: ChainId
  ) {
    super(prisma, stream);
  }
  chainConfigs = getChainConfigsOrThrow<ChainConfig>(config);

  mangroveOrderEventsLogic = new MangroveOrderEventsLogic(this.stream);

  protected async handleParsedEvents(
    events: TypedEvent<mangroveSchema.strategyEvents.StrategyEvent>[],
    tx: PrismaTransaction
  ): Promise<void> {
    const allDbOperation = allDbOperations(tx);
    for (const event of events) {
      const { payload, undo, timestamp } = event;
      const chainId = new ChainId(payload.chainId);
      const chainConfig = this.chainConfigs.find( v => v.id == chainId.value.toString() )

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
          if( !chainConfig?.mangroveOrderInclude ||  (chainConfig?.mangroveOrderInclude?.includes(e.address)))
            await this.mangroveOrderEventsLogic.handleOrderSummary(allDbOperation, chainId, e, undo, transaction)
        },
        SetExpiry: async (e) => {
          if( !chainConfig?.mangroveOrderInclude ||  (chainConfig?.mangroveOrderInclude?.includes(e.address)))
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
