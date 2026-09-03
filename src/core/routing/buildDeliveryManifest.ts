import type { RouteOptimizer } from "../../ports/RouteOptimizer.js";
import type { Coordinates } from "../types.js";
import { RouteOptimizationIncompleteError, RouteOptimizationUnavailableError } from "../errors.js";
import { buildNavigationLink } from "./navigationLink.js";
import type { DeliveryManifest, ManifestStop, OrderForRouting } from "./types.js";

/**
 * Monta o manifesto do entregador para uma leva: ordem otimizada das paradas,
 * distância/tempo por trecho e total, e link de navegação.
 *
 * Round trip (volta à loja) é `false` por decisão confirmada — a rota termina
 * na última entrega, sem voltar à loja no cálculo.
 */
export async function buildDeliveryManifest(
  orders: OrderForRouting[],
  optimizer: RouteOptimizer,
  store: Coordinates,
  roundTrip: boolean = false,
): Promise<DeliveryManifest> {
  if (orders.length === 0) {
    throw new Error("Cannot build a delivery manifest with zero orders");
  }

  let optimized;
  try {
    optimized = await optimizer.optimize({
      depot: store,
      deliveries: orders.map((order) => ({ id: order.orderId, location: order.coordinates })),
      roundTrip,
    });
  } catch (cause) {
    if (cause instanceof RouteOptimizationIncompleteError) throw cause;
    throw new RouteOptimizationUnavailableError(cause);
  }

  const ordersById = new Map(orders.map((order) => [order.orderId, order]));

  let previousCumulativeDistance = 0;
  let previousCumulativeDuration = 0;

  const stops: ManifestStop[] = optimized.stops.map((stop) => {
    const order = ordersById.get(stop.deliveryId);
    if (!order) {
      throw new Error(`Route optimizer returned unknown delivery id: ${stop.deliveryId}`);
    }

    const manifestStop: ManifestStop = {
      sequence: stop.sequence,
      orderId: order.orderId,
      addressLabel: order.addressLabel,
      items: order.items,
      distanceFromPrevMeters: stop.distanceFromStartMeters - previousCumulativeDistance,
      durationFromPrevSeconds: stop.durationFromStartSeconds - previousCumulativeDuration,
      distanceFromStartMeters: stop.distanceFromStartMeters,
      durationFromStartSeconds: stop.durationFromStartSeconds,
    };

    previousCumulativeDistance = stop.distanceFromStartMeters;
    previousCumulativeDuration = stop.durationFromStartSeconds;

    return manifestStop;
  });

  const navigationLink = buildNavigationLink(
    store,
    stops.map((s) => ordersById.get(s.orderId)!.coordinates),
  );

  return {
    stops,
    totalDistanceMeters: optimized.totalDistanceMeters,
    totalDurationSeconds: optimized.totalDurationSeconds,
    navigationLink,
  };
}
