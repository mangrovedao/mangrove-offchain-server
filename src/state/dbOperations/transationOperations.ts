import * as prisma from "@prisma/client";

import { Timestamp } from "@proximaone/stream-client-js";
import {
    TransactionId
} from "../model";
import { DbOperations } from "./dbOperations";


export class TransactionOperations extends DbOperations {

    
    public async ensureTransaction(
        id: TransactionId,
        txHash: string,
        from: string,
        timestamp: Timestamp,
        blockNumber: number,
        blockHash: string
      ): Promise<prisma.Transaction> {
        let transaction = await this.tx.transaction.findUnique({
          where: { id: id.value },
        });
        if (transaction === null) {
          transaction = {
            id: id.value,
            chainId: id.chainId.value,
            txHash: txHash,
            from: from,
            blockNumber: blockNumber,
            blockHash: blockHash,
            time: timestamp.date,
          };
          await this.tx.transaction.create({ data: transaction });
        }
        return transaction;
      }
}