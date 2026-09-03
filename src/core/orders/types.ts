import type { Cents, Coordinates } from "../types.js";
import type { WindowSlot } from "../delivery-window/types.js";

export interface OrderLine {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
}

/**
 * Pedido fechado: tudo aqui é um snapshot congelado no momento da confirmação.
 * A otimização de rota feita depois nunca muda subtotal/frete/total.
 */
export interface Order {
  id: string;
  customerId: string;
  items: OrderLine[];
  subtotalCents: Cents;
  shippingCents: Cents;
  totalCents: Cents;
  addressLabel: string;
  addressCoordinates: Coordinates;
  distanceMeters: number;
  window: { date: string; slot: WindowSlot };
  confirmedAt: string;
}
