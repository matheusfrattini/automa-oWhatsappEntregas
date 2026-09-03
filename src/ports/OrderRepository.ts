import type { Order } from "../core/orders/types.js";
import type { WindowSlot } from "../core/delivery-window/types.js";

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | undefined>;
  listByWindow(date: string, slot: WindowSlot): Promise<Order[]>;
}
