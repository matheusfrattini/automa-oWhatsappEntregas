import type { GeocodingProvider } from "../../../ports/GeocodingProvider.js";
import type { GeocodeCandidate } from "../../../core/address/types.js";
import { requestJson, type HttpClientOptions } from "../../http/httpClient.js";

/**
 * Formato confirmado na documentação oficial (Pelias /v1/search, servido pelo ORS
 * em /geocode/search): https://raw.githubusercontent.com/pelias/documentation/master/response.md
 * GeoJSON FeatureCollection; geometry.coordinates = [lon, lat].
 */
interface OrsGeocodeFeature {
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    label: string;
    confidence: number;
    [key: string]: unknown;
  };
}

interface OrsGeocodeResponse {
  type: "FeatureCollection";
  features: OrsGeocodeFeature[];
}

export interface OrsGeocodingConfig {
  apiKey: string;
  baseUrl: string;
  /** Restringe a busca a um país (ISO 3166-1 alpha-2 ou alpha-3), ex: "BR". */
  boundaryCountry?: string;
  size?: number;
}

/**
 * Cliente do endpoint de geocoding do ORS (GET /geocode/search, autenticado via
 * query param api_key — confirmado em https://ask.openrouteservice.org/t/geocode-search-403/6479).
 * Cacheia por texto de busca: mesmo endereço não consulta a API de novo.
 */
export class OrsGeocodingProvider implements GeocodingProvider {
  private readonly cache = new Map<string, GeocodeCandidate[]>();

  constructor(
    private readonly config: OrsGeocodingConfig,
    private readonly httpOptions: HttpClientOptions = {},
  ) {}

  async search(text: string): Promise<GeocodeCandidate[]> {
    const cacheKey = text.trim().toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      api_key: this.config.apiKey,
      text,
      size: String(this.config.size ?? 5),
    });
    if (this.config.boundaryCountry) {
      params.set("boundary.country", this.config.boundaryCountry);
    }

    const url = `${this.config.baseUrl}/geocode/search?${params.toString()}`;
    const data = await requestJson<OrsGeocodeResponse>(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      this.httpOptions,
    );

    const candidates: GeocodeCandidate[] = data.features.map((feature) => ({
      label: feature.properties.label,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
      },
      confidence: feature.properties.confidence,
    }));

    this.cache.set(cacheKey, candidates);
    return candidates;
  }
}
