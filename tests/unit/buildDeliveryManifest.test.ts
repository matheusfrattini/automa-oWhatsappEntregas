import { describe, expect, it } from "vitest";
import { buildDeliveryManifest } from "../../src/core/routing/buildDeliveryManifest.js";
import { FakeRouteOptimizer } from "../../src/adapters/route-optimizer/fake/FakeRouteOptimizer.js";
import { RouteOptimizationIncompleteError, RouteOptimizationUnavailableError } from "../../src/core/errors.js";
import type { OrderForRouting } from "../../src/core/routing/types.js";

const store = { lat: -23.5558, lon: -46.662 };

const orders: OrderForRouting[] = [
  {
    orderId: "order-1",
    addressLabel: "Rua A, 100",
    coordinates: { lat: -23.56, lon: -46.65 },
    items: [{ name: "Pão francês", quantity: 10, unit: "unidade" }],
  },
  {
    orderId: "order-2",
    addressLabel: "Rua B, 200",
    coordinates: { lat: -23.57, lon: -46.64 },
    items: [{ name: "Leite integral", quantity: 2, unit: "litro" }],
  },
];

describe("buildDeliveryManifest", () => {
  it("monta paradas em ordem com distância/duração por trecho (diff dos cumulativos)", async () => {
    const optimizer = new FakeRouteOptimizer();
    optimizer.setResponse({
      stops: [
        { deliveryId: "order-2", sequence: 1, distanceFromStartMeters: 2000, durationFromStartSeconds: 300 },
        { deliveryId: "order-1", sequence: 2, distanceFromStartMeters: 5000, durationFromStartSeconds: 700 },
      ],
      totalDistanceMeters: 5000,
      totalDurationSeconds: 700,
    });

    const manifest = await buildDeliveryManifest(orders, optimizer, store);

    expect(manifest.stops).toHaveLength(2);
    expect(manifest.stops[0]).toMatchObject({
      orderId: "order-2",
      sequence: 1,
      distanceFromPrevMeters: 2000,
      durationFromPrevSeconds: 300,
    });
    expect(manifest.stops[1]).toMatchObject({
      orderId: "order-1",
      sequence: 2,
      distanceFromPrevMeters: 3000,
      durationFromPrevSeconds: 400,
    });
    expect(manifest.totalDistanceMeters).toBe(5000);
    expect(manifest.navigationLink).toContain("google.com/maps/dir");
  });

  it("envia roundTrip=false para o optimizer por padrão", async () => {
    const optimizer = new FakeRouteOptimizer();
    optimizer.setResponse({
      stops: [{ deliveryId: "order-1", sequence: 1, distanceFromStartMeters: 1000, durationFromStartSeconds: 100 }],
      totalDistanceMeters: 1000,
      totalDurationSeconds: 100,
    });

    await buildDeliveryManifest([orders[0]!], optimizer, store);

    expect(optimizer.getLastRequest()?.roundTrip).toBe(false);
  });

  it("propaga indisponibilidade do optimizer sem inventar rota", async () => {
    const optimizer = new FakeRouteOptimizer();
    optimizer.setFailure(new Error("ORS fora do ar"));

    await expect(buildDeliveryManifest(orders, optimizer, store)).rejects.toThrow(
      RouteOptimizationUnavailableError,
    );
  });

  it("propaga pedidos não atribuídos como erro explícito, sem descartar silenciosamente", async () => {
    const optimizer = new FakeRouteOptimizer();
    optimizer.setFailure(new RouteOptimizationIncompleteError(["order-2"]));

    await expect(buildDeliveryManifest(orders, optimizer, store)).rejects.toThrow(
      RouteOptimizationIncompleteError,
    );
  });

  it("rejeita montar manifesto para leva vazia", async () => {
    const optimizer = new FakeRouteOptimizer();
    await expect(buildDeliveryManifest([], optimizer, store)).rejects.toThrow(
      "Cannot build a delivery manifest with zero orders",
    );
  });
});
