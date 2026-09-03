import type { Cents } from "../types.js";

export interface ShippingQuote {
  distanceMeters: number;
  durationSeconds: number;
  shippingCents: Cents;
}

export interface ShippingConfig {
  baseFeeCents: Cents;
  pricePerKmCents: Cents;
  maxDeliveryRadiusKm: number;
}
