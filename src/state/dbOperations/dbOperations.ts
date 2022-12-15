import * as _ from "lodash";
import * as prisma from "@prisma/client";
import { strict as assert } from "assert";

import {
  AccountId,
  ChainId,
  MakerBalanceId,
  MakerBalanceVersionId,
  MangroveId,
  MangroveVersionId,
  OfferId,
  OfferListId,
  OfferListVersionId,
  OfferVersionId,
  OrderId,
  MangroveOrderId,
  MangroveOrderVersionId,
  TakerApprovalId,
  TakerApprovalVersionId,
  TokenId,
  TransactionId,
} from "../model";
import { Timestamp } from "@proximaone/stream-client-js";
import { MangroveOrder, TakenOffer } from "@prisma/client";
import BigNumber from "bignumber.js";
import {
  getBigNumber,
  getNumber,
  getPrice,
  addNumberStrings,
} from "../handlerUtils";

export class DbOperations {
  public constructor(protected readonly tx: PrismaTx) {}
}

export type PrismaTx = Omit<
  prisma.PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use"
>;

export function toUpsert<T extends { id: string | number }>(
  entity: T
): Upsert<T> {
  return {
    where: { id: entity.id },
    create: entity,
    update: entity,
  };
}

export interface Upsert<T> {
  where: { id: any };
  create: T;
  update: T;
}
