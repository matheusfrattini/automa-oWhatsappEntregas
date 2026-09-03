import { describe, expect, it, vi } from "vitest";
import { OrsRoutingProvider } from "../../src/adapters/routing-provider/ors/OrsRoutingProvider.js";

function directionsResponse(distance: number, duration: number) {
  return new Response(JSON.stringify({ routes: [{ summary: { distance, duration } }] }), {
    status: 200,
  });
}

const origin = { lat: -23.5558, lon: -46.662 };
const destination = { lat: -23.56, lon: -46.65 };

describe("OrsRoutingProvider", () => {
  it("chama /v2/directions/{profile} com coordinates em [lon,lat] e header Authorization", async () => {
    const fetchFn = vi.fn().mockResolvedValue(directionsResponse(3200, 600));
    const provider = new OrsRoutingProvider(
      { apiKey: "test-key", baseUrl: "https://api.openrouteservice.org", profile: "driving-car" },
      { fetchFn },
    );

    const result = await provider.getRouteDistance(origin, destination);

    expect(result).toEqual({ distanceMeters: 3200, durationSeconds: 600 });

    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.openrouteservice.org/v2/directions/driving-car");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.coordinates).toEqual([
      [origin.lon, origin.lat],
      [destination.lon, destination.lat],
    ]);
  });

  it("usa driving-car como perfil padrão", async () => {
    const fetchFn = vi.fn().mockResolvedValue(directionsResponse(1000, 200));
    const provider = new OrsRoutingProvider(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );
    await provider.getRouteDistance(origin, destination);
    const [url] = fetchFn.mock.calls[0]! as [string];
    expect(url).toContain("/v2/directions/driving-car");
  });

  it("cacheia por par de coordenadas", async () => {
    const fetchFn = vi.fn().mockResolvedValue(directionsResponse(1000, 200));
    const provider = new OrsRoutingProvider(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );
    await provider.getRouteDistance(origin, destination);
    await provider.getRouteDistance(origin, destination);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("propaga erro quando a resposta não tem routes (nunca inventa distância)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [] }), { status: 200 }));
    const provider = new OrsRoutingProvider(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );
    await expect(provider.getRouteDistance(origin, destination)).rejects.toThrow();
  });
});
