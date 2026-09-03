import type {
  OptimizationDelivery,
  OptimizationRequest,
  OptimizedRoute,
  RouteOptimizer,
} from "../../../ports/RouteOptimizer.js";
import type { Coordinates } from "../../../core/types.js";
import { haversineDistanceMeters, OFFLINE_AVG_SPEED_KMH, OFFLINE_ROAD_FACTOR } from "../../offline/haversine.js";

/**
 * Otimização simulada (heurística do vizinho mais próximo sobre linha reta),
 * usada SOMENTE quando ORS_API_KEY não está configurada. Não é ótima nem usa
 * distância rodada real — existe para o simulador funcionar de ponta a ponta
 * sem chave de API.
 */
export class OfflineRouteOptimizer implements RouteOptimizer {
  async optimize(request: OptimizationRequest): Promise<OptimizedRoute> {
    const remaining: OptimizationDelivery[] = [...request.deliveries];
    let current: Coordinates = request.depot;
    let cumulativeDistance = 0;
    let cumulativeDuration = 0;
    let sequence = 1;

    const stops: OptimizedRoute["stops"] = [];

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      remaining.forEach((delivery, index) => {
        const distance = haversineDistanceMeters(current, delivery.location);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const [next] = remaining.splice(nearestIndex, 1);
      const legDistanceMeters = nearestDistance * OFFLINE_ROAD_FACTOR;
      const legDurationSeconds = (legDistanceMeters / 1000 / OFFLINE_AVG_SPEED_KMH) * 3600;

      cumulativeDistance += legDistanceMeters;
      cumulativeDuration += legDurationSeconds;

      stops.push({
        deliveryId: next!.id,
        sequence: sequence++,
        distanceFromStartMeters: cumulativeDistance,
        durationFromStartSeconds: cumulativeDuration,
      });

      current = next!.location;
    }

    return {
      stops,
      totalDistanceMeters: cumulativeDistance,
      totalDurationSeconds: cumulativeDuration,
    };
  }
}
