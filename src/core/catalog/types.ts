import type { Cents } from "../types.js";

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  priceCents: Cents;
  unit: string;
  available: boolean;
}
