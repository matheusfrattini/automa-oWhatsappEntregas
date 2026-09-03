import type { RouteDistance, RoutingProvider } from "../../../ports/RoutingProvider.js";
import type { Coordinates } from "../../../core/types.js";
import { requestJson, type HttpClientOptions } from "../../http/httpClient.js";

/**
 * Formato confirmado via curl de exemplo oficial (ask.openrouteservice.org) e
 * openrouteservice-py: POST /v2/directions/{profile}, body { coordinates: [[lon,lat],...] },
 * resposta routes[0].summary.{distance,duration}. Auth via header Authorization: <API_KEY>
 * (sem prefixo "Bearer").
 */
interface OrsDirectionsResponse {
  routes: Array<{
    summary: {
      distance: number;
      duration: number;
    };
  }>;
}

export interface OrsRoutingConfig {
  apiKey: string;
  baseUrl: string;
  /** Perfil de roteamento ORS. Entrega de moto/carro pequeno: "driving-car" (não existe perfil de moto no ORS). */
  profile?: string;
}

/**
 * Cliente do endpoint de directions do ORS para distância rodada ponto-a-ponto.
 * Cacheia por par de coordenadas: mesma origem/destino não consulta a API de novo.
 */
export class OrsRoutingProvider implements RoutingProvider {
  private readonly cache = new Map<string, RouteDistance>();

  constructor(
    private readonly config: OrsRoutingConfig,
    private readonly httpOptions: HttpClientOptions = {},
  ) {}

  private cacheKey(origin: Coordinates, destination: Coordinates): string {
    return `${origin.lat},${origin.lon}->${destination.lat},${destination.lon}`;
  }

  async getRouteDistance(origin: Coordinates, destination: Coordinates): Promise<RouteDistance> {
    const key = this.cacheKey(origin, destination);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const profile = this.config.profile ?? "driving-car";
    const url = `${this.config.baseUrl}/v2/directions/${profile}`;

    const data = await requestJson<OrsDirectionsResponse>(
      url,
      {
        method: "POST",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json, application/gpx+xml",
        },
        body: JSON.stringify({
          coordinates: [
            [origin.lon, origin.lat],
            [destination.lon, destination.lat],
          ],
        }),
      },
      this.httpOptions,
    );

    const summary = data.routes?.[0]?.summary;
    if (!summary) {
      throw new Error("ORS directions response missing routes[0].summary");
    }

    const result: RouteDistance = {
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
    };
    this.cache.set(key, result);
    return result;
  }
}
