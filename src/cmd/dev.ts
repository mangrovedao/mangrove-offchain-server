#!/usr/bin/env node

import * as dotenv from "dotenv";
import { program } from "commander";
import {
  ProximaStreamClient,
  Offset,
  StreamEvent,
} from "@proximaone/stream-client-js";
import { filter, map, takeWhile, tap } from "rxjs";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import logger from "src/utils/logger";

dotenv.config();
const orderId =
  "polygon-mumbai-0xa34b-0xc873x0xf61c-0xef556623fb2757b42db21a7886c40ff64e25ffbc646e38464139f0bb0ece93f3-0";

const proximaClient = new ProximaStreamClient();

const defaultStream = "proxima.mangrove.polygon-mumbai.domain-events.0_1";

async function main() {
  program.name("dev").usage("<command> [options]");

  program
    .command("filter-order <orderId>")
    .option("-s, --stream", "stream", defaultStream)
    .action(async (orderId, options) => {
      logger.info(`looking for order ${orderId} in ${options.stream}`);
      const $stream = await proximaClient.streamEvents(
        options.stream,
        Offset.zero
      );
      const filtered = $stream.observable.pipe(
        tap(notifyProgress),
        map((x) => deserializeMangroveEvent(x)),
        filter(
          (x) =>
            x.event.payload.type == "OrderCompleted" &&
            x.event.payload.id == orderId
        )
      );

      filtered.subscribe((x) => {
        console.dir(x, { depth: 10 });
      });
    });

  program
    .command("dump-stream")
    .option("-s, --stream <stream>", "stream", defaultStream)
    .option("-f, --from <from>", "offset from", Offset.zero.toString())
    .option("-f, --to <to>", "offset to", "")
    .action(async (options) => {
      logger.info(`dumping stream ${options.stream} from ${options.from}`);
      const $stream = await proximaClient.streamEvents(
        options.stream,
        Offset.fromString(options.from)
      );

      const offsetTo = options.to ? Offset.fromString(options.to) : undefined;

      const deserialized = $stream.observable.pipe(
        takeWhile((x) => {
          return offsetTo ? !x.offset.equals(offsetTo) : true;
        }),
        map((x) => deserializeMangroveEvent(x))
      );

      deserialized.subscribe((x) => {
        console.dir(x, { depth: 10 });
      });
    });

  await program.parseAsync(process.argv);
}

function deserializeMangroveEvent(event: StreamEvent) {
  return {
    event: {
      payload: mangroveSchema.streams.mangrove.serdes.deserialize(
        Buffer.from(event.payload)
      ),
      undo: event.undo,
      timestamp: event.timestamp,
    },
    newState: event.offset,
  };
}

let lastNotified = 0;
function notifyProgress(event: StreamEvent) {
  if (new Date().getTime() - lastNotified < 5000) return;
  logger.info(`progress: ${event.offset.toString()}`);
  lastNotified = new Date().getTime();
}

main()
  .catch((e) => {
    throw e;
  })
  .finally(async () => {});
