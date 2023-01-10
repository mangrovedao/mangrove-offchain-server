import { PrismaClient } from "@prisma/client";
import {
  BufferedStreamReader, Offset,
  ProximaStreamClient, StreamRegistryClient, Timestamp,
} from "@proximaone/stream-client-js";
import retry from "async-retry";
import * as _ from "lodash";
import { Subscription, takeWhile } from "rxjs";
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

type streamLinks = {
  stream: {
    handler: StreamEventHandler, 
    toHeight?: bigint
  }[]
  then?: streamLinks[]
}

async function main() {
  let streamLinks: streamLinks[] = [];
  for (const chain of getChainConfigsOrThrow<ChainConfig>(config)) {
    logger.info(`consuming chain ${chain.id} using following streams ${JSON.stringify(chain.streams)}`);
    const chainId = new ChainId(parseInt( chain.id) );
    const tokenPreloads: {handler: StreamEventHandler, toHeight: bigint}[] = [];
    const mangrovePreloads: {handler: StreamEventHandler, toHeight: bigint}[] = [];
    const takerStratPreloads: {handler: StreamEventHandler, toHeight?: bigint}[] = [];

    const tokenStreams = chain.streams.tokens ?? [];
    for (const tokenStream of tokenStreams) {
      const lastOffset = await getStreamLastOffset(tokenStream);
      if (lastOffset){
        tokenPreloads.push({handler: new TokenEventHandler(prisma, tokenStream, chainId), toHeight: lastOffset.height });
      }

    }

    const mangroveStreams = chain.streams.mangrove ?? [];
    for (const mangroveStream of mangroveStreams) {
      const lastOffset = await getStreamLastOffset(mangroveStream);
      if (lastOffset)
        mangrovePreloads.push({handler: new MangroveEventHandler(prisma, mangroveStream, chainId), toHeight: lastOffset.height });

    }

    const takerStratStreams = chain.streams.strats ?? [];
    for (const takerStratStream of takerStratStreams) {
      takerStratPreloads.push({handler: new TakerStratEventHandler(prisma, takerStratStream, chainId)})
    }

    streamLinks.push( { stream: tokenPreloads, then: [{ stream: mangrovePreloads, then: [{stream: takerStratPreloads }] }] } )
  }

  await Promise.all( 
    streamLinks.map( value => handleStreamLinks(value))
   )

}

async function handleStreamLinks( streamLink: streamLinks){
  await Promise.all(  streamLink.stream.map( ( ({handler, toHeight}) => {
        return retry( () => consumeStream({ handler, toHeight: toHeight ?? BigInt(0) } ) )
      } ), {
        retries: retries,
        factor: retryFactor,
      } ) );

  let promises:Promise<void[]>[] = []
  let continueStreams = Promise.all(  streamLink.stream.map( ({handler }) => {
    return retry( () => consumeStream( { handler }) )
  }, {
    retries: retries,
    factor: retryFactor,
  } ) )
  promises.push(continueStreams)
  if(streamLink.then){
    let thenStreamLinks = Promise.all( streamLink.then.map( (value) => handleStreamLinks(value)) );
    promises.push(thenStreamLinks)
  }
  await Promise.all( promises );
}

async function consumeStream(params:{handler: StreamEventHandler, toHeight?: bigint}) {
  
  const currentOffset = await params.handler.getCurrentStreamOffset();
  const stream = params.handler.getStreamName();

  logger.info(
    `consuming stream ${stream} from offset ${currentOffset.toString()} to ${params.toHeight}`
  );
  let eventStream = await streamClient.streamEvents(stream, currentOffset);

  if (params.toHeight != undefined) {
    if (currentOffset.height >= params.toHeight){
      logger.info(`Already caught up on this stream: ${stream}`)
      return;
    }

    eventStream = eventStream.pipe(takeWhile(x => x.offset.height < (params.toHeight ?? BigInt(0)), true));
  }

  const reader = BufferedStreamReader.fromStream(eventStream);

  while (!stopped) {
    const events = await reader.read(batchSize);
    if (events === undefined) {
      logger.info(`Finished consuming stream ${stream}`);
      break;
    }

    try {
      await params.handler.handleEvents(events);
    } catch (err) {
      logger.warn(`error handling events ${err}`);
      throw err;
    }

    logger.info(
      `handled ${stream}: ${events[events.length - 1].offset.toString()}`
    );
  }

  logger.info(`done consuming stream ${stream} from offset ${currentOffset.toString()} to ${params.toHeight}`)
}

async function getStreamLastOffset(stream: string): Promise<Offset | undefined> {
  const registry = new StreamRegistryClient();
  const streamInfo = await registry.findStream(stream);
  if (!streamInfo)
    return undefined;

  return _.chain(streamInfo.endpoints)
    .values()
    .flatMap(x => x.stats.end ? [x.stats.end] : [])
    .maxBy(x => x.height)
    .value();
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
