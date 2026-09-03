export type WindowSlot = "12h" | "16h";

export interface DeliveryWindowAssignment {
  /** Data da leva (YYYY-MM-DD), no timezone da loja — não necessariamente o dia da confirmação. */
  date: string;
  slot: WindowSlot;
}
