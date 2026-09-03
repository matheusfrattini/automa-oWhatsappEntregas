import type { GeocodeCandidate } from "../core/address/types.js";

/**
 * Porta para geocoding. Implementação real (Estágio 3... já adiantado aqui)
 * chama o endpoint /geocode/search do ORS (Pelias por baixo).
 */
export interface GeocodingProvider {
  search(text: string): Promise<GeocodeCandidate[]>;
}
