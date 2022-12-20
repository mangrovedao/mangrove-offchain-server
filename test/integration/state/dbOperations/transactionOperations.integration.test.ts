import { PrismaClient, Transaction } from "@prisma/client";
import assert from "assert";
import { after, before, describe, it } from "mocha";
import { TransactionOperations } from "../../../../src/state/dbOperations/transactionOperations";
import {
  ChainId,
  TransactionId
} from "../../../../src/state/model";
import { clearPostgres } from "../../../../src/utils/test/prismaUtils";
import {prisma} from "../../../../src/utils/test/mochaHooks"
import { Timestamp } from "@proximaone/stream-client-js";

describe("Transaction Operations Integration test suite", () => {
  let transactionOperations: TransactionOperations;
  before(() => {
    transactionOperations = new TransactionOperations(prisma);
  });

  const chainId = new ChainId(10);
  const transactionId = new TransactionId(chainId, "txHash");
  let transaction:Transaction;


  beforeEach(async () => {
    transaction = await prisma.transaction.create({
      data: {
        id: transactionId.value,
        chainId: chainId.value,
        txHash: transactionId.txHash,
        from: "from",
        blockNumber: 10,
        blockHash: "blockHash",
        time: new Date()
      },
    });


  });

  describe("TransactionOperations", () => {
    it("Transaction doesn't exist, creates it", async () => {
      assert.strictEqual(await prisma.transaction.count(), 1);
      const newTransactionId = new TransactionId(chainId, "newTxHash");
      const params
       = {
        id: newTransactionId,
        txHash: "newTxHash",
        from: "from",
        timestamp: Timestamp.fromEpochMs(1671490800000), // Tue Dec 20 2022 00:00:00
        blockHash: "newBlockHash",
        blockNumber: 11
      };
      await transactionOperations.ensureTransaction(params
        );
      assert.strictEqual(await prisma.transaction.count(), 2);
      const newTransaction = await prisma.transaction.findUnique({ where: { id: newTransactionId.value } })
      assert.deepStrictEqual(newTransaction, {
        id: params.id.value,
        chainId: params.id.chainId.value,
        txHash: params.txHash,
        from: params.from,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        time: new Date( params.timestamp.epochMs ),
      })
    });

    it("Transaction does exist, do not create again", async () => {
      assert.strictEqual(await prisma.transaction.count(), 1);
      const params
       = {
        id: transactionId,
        txHash: "newTxHash",
        from: "newFrom",
        timestamp: Timestamp.fromEpochMs(1671490800000), // Tue Dec 20 2022 00:00:00
        blockHash: "newBlockHash",
        blockNumber: 11
      };
      await transactionOperations.ensureTransaction(params);
      assert.strictEqual(await prisma.transaction.count(), 1);
      const existingTransaction = await prisma.transaction.findUnique({ where: { id: transactionId.value } })
      assert.deepStrictEqual(existingTransaction, transaction)
    })

  })





});
