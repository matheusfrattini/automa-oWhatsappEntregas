import type { RoutingProvider } from "../../ports/RoutingProvider.js";
import type { Coordinates } from "../types.js";
import { OutOfDeliveryRadiusError, RoutingUnavailableError } from "../errors.js";
import type { ShippingConfig, ShippingQuote } from "./types.js";

/**
 * Calcula o frete: taxa_base + (preço_por_km * distância rodada loja->cliente).
 *
 * - A distância vem sempre do RoutingProvider (rota rodada, não linha reta).
 * - Se o provider falhar, não inventamos valor: propagamos RoutingUnavailableError
 *   para quem chama decidir escalar.
 * - Se a distância exceder o raio máximo configurado, lançamos OutOfDeliveryRadiusError
 *   (raio é inclusivo: distância == máximo ainda é aceita).
 * - Arredondamento: preço_por_km * distância é arredondado ao centavo mais próximo
 *   antes de somar a taxa base.
 */
export async function calculateShipping(
  routing: RoutingProvider,
  origin: Coordinates,
  destination: Coordinates,
  config: ShippingConfig,
): Promise<ShippingQuote> {
  let distance;
  try {
    distance = await routing.getRouteDistance(origin, destination);
  } catch (cause) {
    throw new RoutingUnavailableError(cause);
  }

  const distanceKm = distance.distanceMeters / 1000;
  if (distanceKm > config.maxDeliveryRadiusKm) {
    throw new OutOfDeliveryRadiusError(distanceKm, config.maxDeliveryRadiusKm);
  }

  const variableCents = Math.round(config.pricePerKmCents * distanceKm);
  const shippingCents = config.baseFeeCents + variableCents;

  return {
    distanceMeters: distance.distanceMeters,
    durationSeconds: distance.durationSeconds,
    shippingCents,
  };
}
