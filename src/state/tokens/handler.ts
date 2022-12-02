import * as prisma from "@prisma/client";
import {
  PrismaStateTransitionHandler,
  PrismaTransaction,
  TypedEvent,
} from "../../common";

import * as ft from "@proximaone/stream-schema-fungible-token";
import { ChainId, TokenId } from "../model";

export class TokenEventHandler extends PrismaStateTransitionHandler<ft.streams.NewFungibleTokenStreamEvent> {
  protected async handleEvents(
    events: TypedEvent<ft.streams.NewFungibleTokenStreamEvent>[],
    tx: PrismaTransaction
  ): Promise<void> {
    const commands: Promise<any>[] = [];
    // ensure all chains exist
    for (const [chainName, chainId] of Object.entries(chains)) {
      // FIXME: There's a bug that will cause this to occasionally fail, see https://github.com/prisma/prisma/issues/11191 // should be fixed now
      // tx.chain.upsert({
      //   where: { id: chainId },
      //   create: { id: chainId, name: chainName },
      //   update: { id: chainId, name: chainName },
      // })
      commands.push(
        tx.chain.findUnique({ where: { id: chainId } }).then((chain) => {
          if (chain === null) {
            return tx.chain.create({
              data: { id: chainId, name: chainName },
            });
          }
        })
      );
    }
    await Promise.all(commands);
    commands.length = 0;

    // handle
    for (const event of events) {
      const { undo, timestamp, payload } = event;
      // Skip tokens with malformed data
      if (!isValidToken(payload)) {
        continue;
      }

      const tokenId = this.getTokenId(payload);
      if (undo) {
        // ensure that all preceeding events have been processed and undo sequentially
        // before proceeding to avoid parellel handling of undos with following NewToken events
        await Promise.all(commands);
        commands.length = 0;
        await tx.token.delete({
          where: { id: tokenId.value },
        });
      } else {
        commands.push(
          tx.token
            .create({
              data: {
                id: tokenId.value,
                chainId: chains[payload.chain],
                address: payload.contractAddress,
                symbol: payload.symbol,
                name: payload.name,
                decimals: payload.decimals ?? 0,
              },
            })
            .catch((err) => {
              console.error(
                `Token ${tokenId.value} failed to be created`,
                event
              );
              throw err;
            })
        );
      }
    }

    // store
    await Promise.all(commands);
  }

  protected deserialize(
    payload: Buffer
  ): ft.streams.NewFungibleTokenStreamEvent {
    return ft.streams.newFungibleToken.serdes.deserialize(payload);
  }

  private getTokenId(token: ft.NewToken) {
    return new TokenId(new ChainId(chains[token.chain]), token.contractAddress);
  }
}

function isValidToken(token: ft.NewToken) {
  return isValidString(token.name) && isValidString(token.symbol);
}

function isValidString(s: string): boolean {
  return !/.*[\x00].*/.test(s);
}

const chains: Record<string, number> = {
  "polygon-mumbai": 80001,
  "polygon-main": 137,
  "eth-main": 1,
  "bsc-main": 56,
};
