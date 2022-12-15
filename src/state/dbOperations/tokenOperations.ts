import { TokenId } from "../model";
import { DbOperations } from "./dbOperations";

export class TokenOperations extends DbOperations {
  public async assertTokenExists(id: TokenId): Promise<void> {
    const token = await this.tx.token.findUnique({
      where: { id: id.value },
    });
    if (token == undefined) {
      throw new Error(`token ${id.value} doesn't exist`);
    }
  }
}
