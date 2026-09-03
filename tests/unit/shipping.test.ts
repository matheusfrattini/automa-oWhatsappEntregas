import { describe, expect, it } from "vitest";
import { calculateShipping } from "../../src/core/shipping/calculateShipping.js";
import { FakeRoutingProvider } from "../../src/adapters/routing-provider/fake/FakeRoutingProvider.js";
import { OutOfDeliveryRadiusError, RoutingUnavailableError } from "../../src/core/errors.js";
import type { ShippingConfig } from "../../src/core/shipping/types.js";
import type { Coordinates } from "../../src/core/types.js";

const config: ShippingConfig = {
  baseFeeCents: 500,
  pricePerKmCents: 150,
  maxDeliveryRadiusKm: 8,
};

const store: Coordinates = { lat: -23.5558, lon: -46.662 };
const customer: Coordinates = { lat: -23.56, lon: -46.65 };

describe("calculateShipping", () => {
  it("calcula taxa_base + preco_por_km * distancia, arredondado ao centavo", () => {
    const routing = new FakeRoutingProvider();
    routing.setFixedResponse({ distanceMeters: 3200, durationSeconds: 600 });

    return calculateShipping(routing, store, customer, config).then((quote) => {
      // 3.2km * 150 centavos = 480 centavos + 500 base = 980
      expect(quote.shippingCents).toBe(980);
      expect(quote.distanceMeters).toBe(3200);
    });
  });

  it("distância zero cobra apenas a taxa base", async () => {
    const routing = new FakeRoutingProvider();
    routing.setFixedResponse({ distanceMeters: 0, durationSeconds: 0 });

    const quote = await calculateShipping(routing, store, customer, config);
    expect(quote.shippingCents).toBe(500);
  });

  it("aceita distância exatamente igual ao raio máximo (borda inclusiva)", async () => {
    const routing = new FakeRoutingProvider();
    routing.setFixedResponse({ distanceMeters: 8000, durationSeconds: 900 });

    const quote = await calculateShipping(routing, store, customer, config);
    // 8km * 150 = 1200 + 500 = 1700
    expect(quote.shippingCents).toBe(1700);
  });

  it("recusa distância acima do raio máximo", async () => {
    const routing = new FakeRoutingProvider();
    routing.setFixedResponse({ distanceMeters: 8001, durationSeconds: 900 });

    await expect(calculateShipping(routing, store, customer, config)).rejects.toThrow(
      OutOfDeliveryRadiusError,
    );
  });

  it("propaga falha do provider como RoutingUnavailableError, sem inventar valor", async () => {
    const routing = new FakeRoutingProvider();
    routing.setFailure(new Error("ORS timeout"));

    await expect(calculateShipping(routing, store, customer, config)).rejects.toThrow(
      RoutingUnavailableError,
    );
  });

  it("arredonda a parte variável ao centavo mais próximo (meio para cima)", async () => {
    const routing = new FakeRoutingProvider();
    // 1.005km * 150 = 150.75 -> arredonda para 151
    routing.setFixedResponse({ distanceMeters: 1005, durationSeconds: 120 });

    const quote = await calculateShipping(routing, store, customer, config);
    expect(quote.shippingCents).toBe(500 + 151);
  });
});
