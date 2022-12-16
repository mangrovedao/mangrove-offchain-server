import { AccountOperations } from "./accountOperations";
import { ChainOperations } from "./chainOperations";
import { PrismaTx } from "./dbOperations";
import { MakerBalanceOperations } from "./makerBalanceOperations";
import { MangroveOperations } from "./mangroveOperations";
import { MangroveOrderOperations } from "./mangroveOrderOperations";
import { OfferListOperations } from "./offerListOperations";
import { OfferOperations } from "./offerOperations";
import { OrderOperations } from "./orderOperations";
import { TokenOperations } from "./tokenOperations";
import { TakerApprovalOperations } from "./takerApprovalOperations";
import { TransactionOperations } from "./transactionOperations";

export type AllDbOperations = {
  accountOperations: AccountOperations;
  chainOperations: ChainOperations;
  makerBalanceOperations: MakerBalanceOperations;
  mangroveOperation: MangroveOperations;
  mangroveOrderOperations: MangroveOrderOperations;
  offerListOperations: OfferListOperations;
  offerOperations: OfferOperations;
  orderOperations: OrderOperations;
  takerApprovalOperations: TakerApprovalOperations;
  tokenOperations: TokenOperations;
  transactionOperations: TransactionOperations;
};

export function allDbOperations(tx: PrismaTx): AllDbOperations {
  return {
    accountOperations: new AccountOperations(tx),
    chainOperations: new ChainOperations(tx),
    makerBalanceOperations: new MakerBalanceOperations(tx),
    mangroveOperation: new MangroveOperations(tx),
    mangroveOrderOperations: new MangroveOrderOperations(tx),
    offerListOperations: new OfferListOperations(tx),
    offerOperations: new OfferOperations(tx),
    orderOperations: new OrderOperations(tx),
    takerApprovalOperations: new TakerApprovalOperations(tx),
    tokenOperations: new TokenOperations(tx),
    transactionOperations: new TransactionOperations(tx),
  };
}
