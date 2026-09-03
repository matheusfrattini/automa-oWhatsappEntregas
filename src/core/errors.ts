/**
 * Erros de domínio. Nunca capturados silenciosamente para "inventar" um valor —
 * quem chama decide se escala para humano.
 */

export class ItemNotFoundError extends Error {
  constructor(public readonly itemId: string) {
    super(`Catalog item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

export class ItemUnavailableError extends Error {
  constructor(public readonly itemId: string) {
    super(`Catalog item unavailable: ${itemId}`);
    this.name = "ItemUnavailableError";
  }
}

export class InvalidQuantityError extends Error {
  constructor(public readonly quantity: number) {
    super(`Invalid quantity: ${quantity}`);
    this.name = "InvalidQuantityError";
  }
}

export class OutOfDeliveryRadiusError extends Error {
  constructor(public readonly distanceKm: number, public readonly maxRadiusKm: number) {
    super(`Distance ${distanceKm}km exceeds max delivery radius of ${maxRadiusKm}km`);
    this.name = "OutOfDeliveryRadiusError";
  }
}

export class RoutingUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Routing provider is unavailable");
    this.name = "RoutingUnavailableError";
    this.cause = cause;
  }
}

export class GeocodingUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Geocoding provider is unavailable");
    this.name = "GeocodingUnavailableError";
    this.cause = cause;
  }
}
