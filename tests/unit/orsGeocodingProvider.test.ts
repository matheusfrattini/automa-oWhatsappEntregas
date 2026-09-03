import { describe, expect, it, vi } from "vitest";
import { OrsGeocodingProvider } from "../../src/adapters/geocoding/ors/OrsGeocodingProvider.js";

function geocodeResponse(features: Array<{ label: string; confidence: number; lon: number; lat: number }>) {
  return new Response(
    JSON.stringify({
      type: "FeatureCollection",
      features: features.map((f) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.lon, f.lat] },
        properties: { label: f.label, confidence: f.confidence },
      })),
    }),
    { status: 200 },
  );
}

describe("OrsGeocodingProvider", () => {
  it("monta a URL com api_key, text e boundary.country, e converte [lon,lat] para {lat,lon}", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      geocodeResponse([{ label: "Rua Augusta, 1000 - São Paulo, SP, Brasil", confidence: 0.9, lon: -46.66, lat: -23.55 }]),
    );

    const provider = new OrsGeocodingProvider(
      { apiKey: "test-key", baseUrl: "https://api.openrouteservice.org", boundaryCountry: "BR" },
      { fetchFn },
    );

    const candidates = await provider.search("Rua Augusta 1000");

    expect(candidates).toEqual([
      {
        label: "Rua Augusta, 1000 - São Paulo, SP, Brasil",
        coordinates: { lat: -23.55, lon: -46.66 },
        confidence: 0.9,
      },
    ]);

    const calledUrl = new URL(fetchFn.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/geocode/search");
    expect(calledUrl.searchParams.get("api_key")).toBe("test-key");
    expect(calledUrl.searchParams.get("text")).toBe("Rua Augusta 1000");
    expect(calledUrl.searchParams.get("boundary.country")).toBe("BR");
  });

  it("retorna lista vazia quando não há candidatos", async () => {
    const fetchFn = vi.fn().mockResolvedValue(geocodeResponse([]));
    const provider = new OrsGeocodingProvider(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );
    expect(await provider.search("endereço inexistente")).toEqual([]);
  });

  it("cacheia por texto de busca — segunda chamada não bate na API", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      geocodeResponse([{ label: "X", confidence: 0.8, lon: 1, lat: 2 }]),
    );
    const provider = new OrsGeocodingProvider(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );

    await provider.search("mesmo endereço");
    await provider.search("mesmo endereço");

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("propaga erro quando a API falha (nunca inventa candidato)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const provider = new OrsGeocodingProvider(
      { apiKey: "k", baseUrl: "https://api.openrouteservice.org" },
      { fetchFn },
    );
    await expect(provider.search("qualquer coisa")).rejects.toThrow();
  });
});
