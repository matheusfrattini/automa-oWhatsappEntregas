import type { OrderRepository } from "../../../ports/OrderRepository.js";
import type { Order } from "../../../core/orders/types.js";
import type { WindowSlot } from "../../../core/delivery-window/types.js";

/**
 * Guarda pedidos em memória. Suficiente para o simulador e o seed; trocar por
 * SQLite (com migrations) é escrever outra implementação desta porta.
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async listByWindow(date: string, slot: WindowSlot): Promise<Order[]> {
    return [...this.orders.values()].filter(
      (order) => order.window.date === date && order.window.slot === slot,
    );
  }
}
