import type { Cart } from "../cart/types.js";
import type { GeocodeCandidate } from "../address/types.js";
import type { Coordinates } from "../types.js";
import type { ShippingQuote } from "../shipping/types.js";

export type ConversationState =
  | "collecting_order"
  | "awaiting_address"
  | "confirming_address"
  | "confirming_order";

export interface ConfirmedAddress {
  label: string;
  coordinates: Coordinates;
}

export interface ConversationContext {
  customerId: string;
  state: ConversationState;
  cart: Cart;
  pendingAddressCandidates: GeocodeCandidate[];
  addressAttempts: number;
  confirmedAddress?: ConfirmedAddress;
  shippingQuote?: ShippingQuote;
  consecutiveUnclearCount: number;
  isHandoff: boolean;
  handoffReason?: string;
}

export function createConversation(customerId: string): ConversationContext {
  return {
    customerId,
    state: "collecting_order",
    cart: { lines: [] },
    pendingAddressCandidates: [],
    addressAttempts: 0,
    consecutiveUnclearCount: 0,
    isHandoff: false,
  };
}
