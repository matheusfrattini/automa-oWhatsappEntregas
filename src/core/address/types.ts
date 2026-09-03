import type { Coordinates } from "../types.js";

export interface GeocodeCandidate {
  /** Endereço normalizado, pronto para mostrar ao cliente (Pelias "label"). */
  label: string;
  coordinates: Coordinates;
  /** 0..1, confiança do Pelias no resultado. */
  confidence: number;
}

export type AddressResolution =
  | { status: "candidates"; candidates: GeocodeCandidate[] }
  | { status: "not_found" };
