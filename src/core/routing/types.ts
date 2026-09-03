import type { Coordinates } from "../types.js";

export interface ManifestItemLine {
  name: string;
  quantity: number;
  unit: string;
}

export interface OrderForRouting {
  orderId: string;
  addressLabel: string;
  coordinates: Coordinates;
  items: ManifestItemLine[];
}

export interface ManifestStop {
  sequence: number;
  orderId: string;
  addressLabel: string;
  items: ManifestItemLine[];
  distanceFromPrevMeters: number;
  durationFromPrevSeconds: number;
  distanceFromStartMeters: number;
  durationFromStartSeconds: number;
}

export interface DeliveryManifest {
  stops: ManifestStop[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  navigationLink: string;
}
