export interface CartLine {
  itemId: string;
  quantity: number;
}

export interface Cart {
  lines: CartLine[];
}

export interface CartSummaryLine {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CartSummary {
  lines: CartSummaryLine[];
  subtotalCents: number;
}
