import * as prisma from "@prisma/client";
import { ChainId, MangroveId } from "../../../src/state/model";
import { DbOperations } from "./dbOperations";

export class ChainOperations extends DbOperations {
  public async getChainId(mangroveId: MangroveId): Promise<ChainId> {
    const mangrove = await this.tx.mangrove.findUnique({
      where: { id: mangroveId.value },
      select: { chainId: true },
    });
    if (mangrove === null) {
      throw new Error(`Mangrove not found, id: ${mangroveId.value}`);
    }
    return new ChainId(mangrove.chainId);
  }

  public async ensureChain(id: ChainId, name: string): Promise<prisma.Chain> {
    let chain = await this.tx.chain.findUnique({
      where: { id: id.chainlistId },
    });
    if (chain == undefined) {
      chain = {
        id: id.value,
        name: name,
      };
      await this.tx.chain.create({ data: chain });
    }
    return chain;
  }
}
