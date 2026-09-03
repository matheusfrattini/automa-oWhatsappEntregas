import type { Coordinates } from "../core/types.js";

export interface RouteDistance {
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Porta para cálculo de distância/duração rodada entre dois pontos (usada no frete)
 * e otimização de rota com múltiplas paradas (usada no fechamento de leva).
 * Implementação real (Estágio 3) chama o ORS (directions/matrix/optimization).
 */
export interface RoutingProvider {
  /**
   * Distância e duração rodada de origin até destination (não linha reta).
   */
  getRouteDistance(origin: Coordinates, destination: Coordinates): Promise<RouteDistance>;
}
