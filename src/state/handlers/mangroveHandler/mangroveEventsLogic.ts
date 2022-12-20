import * as prisma from "@prisma/client";
import * as mangroveSchema from "@proximaone/stream-schema-mangrove";
import * as _ from "lodash";

import { MangroveParams } from "@proximaone/stream-schema-mangrove/dist/core";
import BigNumber from "bignumber.js";
import { AllDbOperations } from "state/dbOperations/allDbOperations";
import { MakerBalanceOperations } from "state/dbOperations/makerBalanceOperations";
import { MangroveOperations } from "state/dbOperations/mangroveOperations";
import {
  AccountId,
  ChainId,
  MakerBalanceId,
  MangroveId,
  OfferListId,
  OrderId,
  TakerApprovalId,
  TokenId,
} from "../../model";

export class MangroveEventsLogic {
  async handleMangroveCreated(
    undo: boolean,
    mangroveId: MangroveId,
    chainId: ChainId,
    transaction: prisma.Transaction | undefined,
    db: MangroveOperations,
    e: mangroveSchema.events.MangroveCreated
  ) {
    if (undo) {
      await db.deleteLatestMangroveVersion(mangroveId);
      return;
    }

    await db.createMangrove(mangroveId, chainId, e.address, transaction!.id);
  }

  async handleMangroveParamsUpdated(
    undo: boolean,
    mangroveId: MangroveId,
    params: MangroveParams,
    transaction: prisma.Transaction | undefined,
    db: MangroveOperations
  ) {
    if (undo) {
      await db.deleteLatestMangroveVersion(mangroveId);
      return;
    }

    await db.addVersionedMangrove(
      mangroveId,
      (model) => {
        _.merge(model, params);
      },
      transaction!.id
    );
  }

  async handleOfferListParamsUpdated(
    chainId: ChainId,
    offerList: mangroveSchema.core.OfferList,
    mangroveId: MangroveId,
    undo: boolean,
    params: mangroveSchema.core.OfferListParams,
    db: AllDbOperations,
    transaction: prisma.Transaction | undefined
  ) {
    const inboundTokenId = new TokenId(chainId, offerList.inboundToken);
    await db.tokenOperations.assertTokenExists(inboundTokenId);
    const outboundTokenId = new TokenId(chainId, offerList.outboundToken);
    await db.tokenOperations.assertTokenExists(outboundTokenId);
    const id = new OfferListId(mangroveId, offerList);

    if (undo) {
      await db.offerListOperations.deleteLatestOfferListVersion(id);
      return;
    }

    await db.offerListOperations.addVersionedOfferList(
      id,
      transaction!.id,
      (model) => {
        _.merge(model, params);
      }
    );
  }

  async handleMakerBalanceUpdated(
    mangroveId: MangroveId,
    maker: string,
    undo: boolean,
    amountChange: string,
    db: MakerBalanceOperations,
    transaction: prisma.Transaction | undefined
  ) {
    const id = new MakerBalanceId(mangroveId, maker);

    if (undo) {
      await db.deleteLatestMakerBalanceVersion(id);
      return;
    }

    // TODO: Add parentOrderId when sufficient information is available


    await db.addVersionedMakerBalance(id, transaction!.id, (model) => {
      model.balance = new BigNumber(model.balance).plus(new BigNumber(amountChange)).toFixed();
    });
  }

  async handleTakerApprovalUpdated(
    mangroveId: MangroveId,
    offerList: mangroveSchema.core.OfferList,
    owner: string,
    spender: string,
    undo: boolean,
    chainId: ChainId,
    amount: string,
    parentOrderId: OrderId | undefined,
    transaction: prisma.Transaction | undefined,
    db: AllDbOperations
  ) {
    const id = new TakerApprovalId(mangroveId, offerList, owner, spender);

    if (undo) {
      await db.takerApprovalOperations.deleteLatestTakerApprovalVersion(id);
      return;
    }

    await db.accountOperations.ensureAccount(new AccountId(chainId, owner));

    await db.takerApprovalOperations.addVersionedTakerApproval(
      id,
      transaction!.id,
      (model) => {
        model.value = amount;
      },
      parentOrderId
    );
  }
}
