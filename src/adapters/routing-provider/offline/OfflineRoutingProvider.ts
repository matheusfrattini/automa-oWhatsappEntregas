import type { RouteDistance, RoutingProvider } from "../../../ports/RoutingProvider.js";
import type { Coordinates } from "../../../core/types.js";
import { haversineDistanceMeters, OFFLINE_AVG_SPEED_KMH, OFFLINE_ROAD_FACTOR } from "../../offline/haversine.js";

/**
 * Roteamento simulado (linha reta × fator de sinuosidade), usado SOMENTE
 * quando ORS_API_KEY não está configurada. Não é uma distância rodada real —
 * existe para testar o fluxo do simulador de ponta a ponta sem chave de API.
 */
export class OfflineRoutingProvider implements RoutingProvider {
  async getRouteDistance(origin: Coordinates, destination: Coordinates): Promise<RouteDistance> {
    const straightLineMeters = haversineDistanceMeters(origin, destination);
    const distanceMeters = straightLineMeters * OFFLINE_ROAD_FACTOR;
    const durationSeconds = (distanceMeters / 1000 / OFFLINE_AVG_SPEED_KMH) * 3600;
    return { distanceMeters, durationSeconds };
  }
}
