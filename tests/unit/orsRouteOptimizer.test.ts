import { describe, expect, it, vi } from "vitest";
import { OrsRouteOptimizer } from "../../src/adapters/route-optimizer/ors/OrsRouteOptimizer.js";
import { RouteOptimizationIncompleteError } from "../../src/core/errors.js";

const depot = { lat: -23.5558, lon: -46.662 };
const deliveries = [
  { id: "order-1", location: { lat: -23.56, lon: -46.65 } },
  { id: "order-2", location: { lat: -23.57, lon: -46.64 } },
];

function optimizationResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("OrsRouteOptimizer", () => {
  it("mapeia ids de negócio para ids numéricos do VROOM e de volta, sem end (só ida)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      optimizationResponse({
        code: 0,
        unassigned: [],
        routes: [
          {
            vehicle: 1,
            distance: 5000,
            duration: 700,
            steps: [
              { type: "start", distance: 0, duration: 0 },
              { type: "job", job: 2, distance: 2000, duration: 300 },
              { type: "job", job: 1, distance: 5000, duration: 700 },
            ],
          },
        ],
      }),
    );

    const optimizer = new OrsRouteOptimizer(
      { apiKey: "test-key", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );

    const result = await optimizer.optimize({ depot, deliveries, roundTrip: false });

    expect(result).toEqual({
      stops: [
        { deliveryId: "order-2", sequence: 1, distanceFromStartMeters: 2000, durationFromStartSeconds: 300 },
        { deliveryId: "order-1", sequence: 2, distanceFromStartMeters: 5000, durationFromStartSeconds: 700 },
      ],
      totalDistanceMeters: 5000,
      totalDurationSeconds: 700,
    });

    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.openrouteservice.org/optimization");
    const body = JSON.parse(init.body as string);
    expect(body.vehicles[0].start).toEqual([depot.lon, depot.lat]);
    expect(body.vehicles[0].end).toBeUndefined();
    expect(body.jobs).toEqual([
      { id: 1, location: [deliveries[0]!.location.lon, deliveries[0]!.location.lat] },
      { id: 2, location: [deliveries[1]!.location.lon, deliveries[1]!.location.lat] },
    ]);
    expect((init.headers as Record<string, string>).Authorization).toBe("test-key");
  });

  it("inclui end no veículo quando roundTrip=true", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      optimizationResponse({
        code: 0,
        unassigned: [],
        routes: [{ vehicle: 1, distance: 1000, duration: 100, steps: [{ type: "job", job: 1, distance: 1000, duration: 100 }] }],
      }),
    );
    const optimizer = new OrsRouteOptimizer(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );

    await optimizer.optimize({ depot, deliveries: [deliveries[0]!], roundTrip: true });

    const [, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.vehicles[0].end).toEqual([depot.lon, depot.lat]);
  });

  it("lança RouteOptimizationIncompleteError quando há jobs não atribuídos", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      optimizationResponse({
        code: 0,
        unassigned: [{ id: 2 }],
        routes: [{ vehicle: 1, distance: 1000, duration: 100, steps: [{ type: "job", job: 1, distance: 1000, duration: 100 }] }],
      }),
    );
    const optimizer = new OrsRouteOptimizer(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );

    await expect(optimizer.optimize({ depot, deliveries, roundTrip: false })).rejects.toThrow(
      RouteOptimizationIncompleteError,
    );
  });

  it("propaga erro em falha da API (nunca inventa rota)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("server error", { status: 500 }));
    const optimizer = new OrsRouteOptimizer(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn, retries: 0 },
    );

    await expect(optimizer.optimize({ depot, deliveries, roundTrip: false })).rejects.toThrow();
  });
});
