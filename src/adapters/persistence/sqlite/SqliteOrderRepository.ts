import type { DatabaseSync } from "./sqliteModule.js";
import type { OrderRepository } from "../../../ports/OrderRepository.js";
import type { Order, OrderLine } from "../../../core/orders/types.js";
import type { WindowSlot } from "../../../core/delivery-window/types.js";

interface OrderRow {
  id: string;
  customer_id: string;
  items_json: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  address_label: string;
  address_lat: number;
  address_lon: number;
  distance_meters: number;
  window_date: string;
  window_slot: string;
  confirmed_at: string;
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    items: JSON.parse(row.items_json) as OrderLine[],
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    addressLabel: row.address_label,
    addressCoordinates: { lat: row.address_lat, lon: row.address_lon },
    distanceMeters: row.distance_meters,
    window: { date: row.window_date, slot: row.window_slot as WindowSlot },
    confirmedAt: row.confirmed_at,
  };
}

export class SqliteOrderRepository implements OrderRepository {
  constructor(private readonly db: DatabaseSync) {}

  async save(order: Order): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO orders (
          id, customer_id, items_json, subtotal_cents, shipping_cents, total_cents,
          address_label, address_lat, address_lon, distance_meters,
          window_date, window_slot, confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          items_json = excluded.items_json,
          subtotal_cents = excluded.subtotal_cents,
          shipping_cents = excluded.shipping_cents,
          total_cents = excluded.total_cents,
          address_label = excluded.address_label,
          address_lat = excluded.address_lat,
          address_lon = excluded.address_lon,
          distance_meters = excluded.distance_meters,
          window_date = excluded.window_date,
          window_slot = excluded.window_slot,
          confirmed_at = excluded.confirmed_at`,
      )
      .run(
        order.id,
        order.customerId,
        JSON.stringify(order.items),
        order.subtotalCents,
        order.shippingCents,
        order.totalCents,
        order.addressLabel,
        order.addressCoordinates.lat,
        order.addressCoordinates.lon,
        order.distanceMeters,
        order.window.date,
        order.window.slot,
        order.confirmedAt,
      );
  }

  async findById(id: string): Promise<Order | undefined> {
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as unknown as OrderRow | undefined;
    return row ? rowToOrder(row) : undefined;
  }

  async listByWindow(date: string, slot: WindowSlot): Promise<Order[]> {
    const rows = this.db
      .prepare("SELECT * FROM orders WHERE window_date = ? AND window_slot = ? ORDER BY confirmed_at ASC")
      .all(date, slot) as unknown as OrderRow[];
    return rows.map(rowToOrder);
  }
}
