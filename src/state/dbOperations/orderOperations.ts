import { OrderId } from "state/model";
import { DbOperations } from "./dbOperations";

export class OrderOperations extends DbOperations {

    public async deleteOrder(id: OrderId) {
        await this.tx.order.deleteMany({ where: { id: id.value } });
      }
}