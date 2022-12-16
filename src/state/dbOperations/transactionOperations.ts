import * as prisma from "@prisma/client";

import { Timestamp } from "@proximaone/stream-client-js";
import { TransactionId } from "../model";
import { DbOperations } from "./dbOperations";

export class TransactionOperations extends DbOperations {
  public async ensureTransaction( params: {
    id: TransactionId,
    txHash: string,
    from: string,
    timestamp: Timestamp["date"],
    blockNumber: number,
    blockHash: string }
  ): Promise<prisma.Transaction> {
    let transaction = await this.tx.transaction.findUnique({
      where: { id: params.id.value },
    });
    if (transaction === null) {
      transaction = {
        id: params.id.value,
        chainId: params.id.chainId.value,
        txHash: params.txHash,
        from: params.from,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        time: params.timestamp,
      };
      await this.tx.transaction.create({ data: transaction });
    }
    return transaction;
  }
}
