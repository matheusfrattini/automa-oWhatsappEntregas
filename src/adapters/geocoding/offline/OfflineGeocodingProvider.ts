import type { GeocodingProvider } from "../../../ports/GeocodingProvider.js";
import type { GeocodeCandidate } from "../../../core/address/types.js";
import type { Coordinates } from "../../../core/types.js";

function hashOffset(text: string): { dLat: number; dLon: number } {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const a = ((hash % 1000) / 1000) - 0.5;
  const b = ((Math.floor(hash / 1000) % 1000) / 1000) - 0.5;
  // +-0.05 grau ~ +-5km da loja
  return { dLat: a * 0.05, dLon: b * 0.05 };
}

/**
 * Geocoding simulado, usado SOMENTE quando ORS_API_KEY não está configurada.
 * Gera uma coordenada determinística (hash do texto) perto da loja — não é um
 * endereço real. Existe para o simulador funcionar de ponta a ponta sem exigir
 * uma chave de API antes de você testar o fluxo de conversa.
 */
export class OfflineGeocodingProvider implements GeocodingProvider {
  constructor(private readonly store: Coordinates) {}

  async search(text: string): Promise<GeocodeCandidate[]> {
    const trimmed = text.trim();
    if (trimmed.length === 0) return [];

    const { dLat, dLon } = hashOffset(trimmed.toLowerCase());
    const candidate: GeocodeCandidate = {
      label: `${trimmed} (endereço simulado — ORS_API_KEY não configurada)`,
      coordinates: { lat: this.store.lat + dLat, lon: this.store.lon + dLon },
      confidence: 0.7,
    };
    return [candidate];
  }
}
