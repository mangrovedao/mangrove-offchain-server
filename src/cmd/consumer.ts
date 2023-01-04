import { PrismaClient } from "@prisma/client";
import {
  BufferedStreamReader,
  ProximaStreamClient,
} from "@proximaone/stream-client-js";
import retry from "async-retry";
import { Subscription } from "rxjs";
import { StreamEventHandler } from "src/common";
import {
  MangroveEventHandler,
  IOrderLogicEventHandler as TakerStratEventHandler,
  TokenEventHandler,
} from "src/state";
import { ChainId } from "src/state/model";
import { ChainConfig } from "src/utils/config/ChainConfig";
import config from "src/utils/config/config";
import { getChainConfigsOrThrow } from "src/utils/config/configUtils";
import logger from "src/utils/logger";

const retries = parseInt(process.env["CONSUMER_RETRIES"] ?? "100");
const retryFactor = parseFloat(process.env["CONSUMER_RETRY_FACTOR"] ?? "1.2");
const batchSize = parseInt(process.env["BATCH_SIZE"] ?? "50");

const prisma = new PrismaClient();
const streamClient = new ProximaStreamClient();

let stopped = false;
let subscription: Subscription;

async function main() {
  const streamEventHandlers: StreamEventHandler[] = [];
  for (const chain of getChainConfigsOrThrow<ChainConfig>(config)) {
    logger.info(`consuming chain ${chain.id} using following streams ${JSON.stringify(chain.streams)}`);

    const chainId = new ChainId(parseInt( chain.id) );
    streamEventHandlers.push(
      ...(chain.streams?.mangrove ?? []).map(
        (s) => new MangroveEventHandler(prisma, s, chainId)
      )
    );
    streamEventHandlers.push(
      ...(chain.streams?.tokens ?? []).map(
        (s) => new TokenEventHandler(prisma, s, chainId)
      )
    );
    streamEventHandlers.push(
      ...(chain.streams?.strats ?? []).map(
        (s) => new TakerStratEventHandler(prisma, s, chainId)
      )
    );
  }

  await Promise.all(
    streamEventHandlers.map((handler) => retry(() => consumeStream(handler)), {
      retries: retries,
      factor: retryFactor,
    })
  );
}

async function consumeStream(handler: StreamEventHandler) {
  const currentOffset = await handler.getCurrentStreamOffset();
  const stream = handler.getStreamName();

  logger.info(
    `consuming stream ${stream} from offset ${currentOffset.toString()}`
  );
  const pauseable = await streamClient.streamEvents(stream, currentOffset);
  const reader = BufferedStreamReader.fromStream(pauseable);

  while (!stopped) {
    const events = await reader.read(batchSize);
    if (events === undefined) {
      logger.info(`Finished consuming stream ${stream}`);
      break;
    }

    try {
      await handler.handleEvents(events);
    } catch (err) {
      console.info("error handling events", err);
      throw err;
    }

    logger.info(
      `handled ${stream}: ${events[events.length - 1].offset.toString()}`
    );
  }
}

main()
  .catch((e) => {
    throw e;
  })
  .finally(async () => {
    stopped = true;
    if (subscription) subscription.unsubscribe();
    await prisma.$disconnect();
  });
