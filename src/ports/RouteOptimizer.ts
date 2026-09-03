import type { Coordinates } from "../core/types.js";

export interface OptimizationDelivery {
  /** Id de negócio (ex: order id). A porta cuida de mapear para o formato exigido pelo provider. */
  id: string;
  location: Coordinates;
}

export interface OptimizationRequest {
  depot: Coordinates;
  deliveries: OptimizationDelivery[];
  /**
   * Se true, a rota volta ao depot após a última entrega. Parâmetro existe desde já
   * porque a decisão de round-trip pode mudar; hoje o núcleo sempre chama com false.
   */
  roundTrip: boolean;
  /**
   * Capacidade do veículo (unidades multidimensionais, ex: [peso_kg, volume_l]).
   * Não aplicada nesta fase (nenhum job leva "delivery"/"amount") — existe só como
   * ponto de extensão, porque vai ser necessário quando o catálogo crescer.
   */
  vehicleCapacity?: number[];
}

export interface OptimizedStop {
  deliveryId: string;
  sequence: number;
  /** Cumulativo desde o depot até esta parada. */
  distanceFromStartMeters: number;
  durationFromStartSeconds: number;
}

export interface OptimizedRoute {
  stops: OptimizedStop[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

/**
 * Porta para otimização de rota com múltiplas paradas. Implementação real usa o
 * endpoint /optimization do ORS (que roda VROOM por baixo).
 */
export interface RouteOptimizer {
  optimize(request: OptimizationRequest): Promise<OptimizedRoute>;
}
