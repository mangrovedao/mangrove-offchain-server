import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";

import { strict as assert } from "assert";
import { AllDbOperations } from "state/dbOperations/allDbOperations";
import { PrismaTransaction } from "../../../common";
import {
  ChainId,
  MangroveId,
  OrderId
} from "../../model";

export class OrderEventLogic {
  async handleOrderCompleted(
    txRef: any,
    order: mangroveSchema.core.Order,
    offerList: mangroveSchema.core.OfferList,
    id: string,
    undo: boolean,
    mangroveId: MangroveId,
    chainId: ChainId,
    transaction: prisma.Transaction | undefined,
    db: AllDbOperations,
    parentOrderId: OrderId | undefined,
    tx: PrismaTransaction
  ) {
    assert(txRef);
    const orderId = new OrderId(mangroveId, offerList, id);

    if (undo) {
      await db.orderOperations.undoOrder(mangroveId, offerList, orderId, order);
      return;
    }

    await db.orderOperations.createOrder(mangroveId, offerList, db, order, chainId, tx, orderId, transaction, parentOrderId);
  }

  


}
