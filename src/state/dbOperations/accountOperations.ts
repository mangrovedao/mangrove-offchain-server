import { AccountId } from "state/model";
import { DbOperations } from "./dbOperations";
import * as prisma from "@prisma/client";

export class AccountOperations extends DbOperations {
  public async ensureAccount(id: AccountId): Promise<prisma.Account> {
    let account = await this.tx.account.findUnique({ where: { id: id.value } });
    if (account == undefined) {
      account = {
        id: id.value,
        chainId: id.chainId.value,
        address: id.address,
      };
      await this.tx.account.create({ data: account });
    }
    return account;
  }
}
