import { describe, expect, it } from "vitest";
import { OfflineGeocodingProvider } from "../../src/adapters/geocoding/offline/OfflineGeocodingProvider.js";
import { OfflineRoutingProvider } from "../../src/adapters/routing-provider/offline/OfflineRoutingProvider.js";
import { OfflineRouteOptimizer } from "../../src/adapters/route-optimizer/offline/OfflineRouteOptimizer.js";

const store = { lat: -23.5558, lon: -46.662 };

describe("OfflineGeocodingProvider", () => {
  it("gera uma coordenada determinística perto da loja para o mesmo texto", async () => {
    const provider = new OfflineGeocodingProvider(store);
    const first = await provider.search("Rua Augusta 1000");
    const second = await provider.search("Rua Augusta 1000");
    expect(first).toEqual(second);
    expect(first[0]!.label).toContain("endereço simulado");
  });

  it("gera coordenadas diferentes para textos diferentes", async () => {
    const provider = new OfflineGeocodingProvider(store);
    const a = await provider.search("Rua A");
    const b = await provider.search("Rua B");
    expect(a[0]!.coordinates).not.toEqual(b[0]!.coordinates);
  });

  it("retorna lista vazia para texto vazio", async () => {
    const provider = new OfflineGeocodingProvider(store);
    expect(await provider.search("   ")).toEqual([]);
  });
});

describe("OfflineRoutingProvider", () => {
  it("aproxima distância rodada a partir da linha reta com fator de sinuosidade", async () => {
    const provider = new OfflineRoutingProvider();
    // ~0.01 grau de latitude ~ 1.11km em linha reta
    const result = await provider.getRouteDistance(store, { lat: store.lat + 0.01, lon: store.lon });
    expect(result.distanceMeters).toBeGreaterThan(1000);
    expect(result.distanceMeters).toBeLessThan(2000);
    expect(result.durationSeconds).toBeGreaterThan(0);
  });

  it("distância zero para a mesma coordenada", async () => {
    const provider = new OfflineRoutingProvider();
    const result = await provider.getRouteDistance(store, store);
    expect(result.distanceMeters).toBe(0);
  });
});

describe("OfflineRouteOptimizer", () => {
  it("ordena paradas pelo vizinho mais próximo a partir do depósito", async () => {
    const optimizer = new OfflineRouteOptimizer();
    const near = { lat: store.lat + 0.001, lon: store.lon };
    const far = { lat: store.lat + 0.02, lon: store.lon };

    const result = await optimizer.optimize({
      depot: store,
      deliveries: [
        { id: "far", location: far },
        { id: "near", location: near },
      ],
      roundTrip: false,
    });

    expect(result.stops.map((s) => s.deliveryId)).toEqual(["near", "far"]);
    expect(result.totalDistanceMeters).toBeGreaterThan(0);
  });
});
