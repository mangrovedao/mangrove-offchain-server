import {
  PrismaStreamEventHandler,
  PrismaTransaction,
  TypedEvent,
} from "src/common";

import { ChainId, TokenId } from "src/state/model";
import { PrismaClient } from "@prisma/client";

export class TokenEventHandler extends PrismaStreamEventHandler<NewToken> {
  public constructor(
    prisma: PrismaClient,
    stream: string,
    private readonly chainId: ChainId
  ) {
    super(prisma, stream);
  }

  protected async handleParsedEvents(
    events: TypedEvent<NewToken>[],
    tx: PrismaTransaction
  ): Promise<void> {
    const commands: Promise<any>[] = [];
    // ensure all chains exist
    for (const [chainName, chainId] of Object.entries(chains)) {
      await tx.chain.upsert({
        where: { id: chainId },
        create: { id: chainId, name: chainName },
        update: { id: chainId, name: chainName },
      });
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
      const { undo, payload } = event;
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
        const result = await tx.token.delete({
          where: { id: tokenId.value },
        });
      } else {
        commands.push(
          tx.token
            .create({
              data: {
                id: tokenId.value,
                chainId: this.chainId.chainlistId,
                address: payload.address,
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

  protected deserialize(payload: Buffer): NewToken {
    return JSON.parse(payload.toString());
  }

  private getTokenId(token: NewToken) {
    return new TokenId(this.chainId, token.address);
  }
}

function isValidToken(token: NewToken) {
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

export interface NewToken {
  address: string;
  symbol: string;
  name: string;
  totalSupply: string;
  decimals?: number;
}
