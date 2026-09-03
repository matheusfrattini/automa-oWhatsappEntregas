import { describe, expect, it } from "vitest";
import { resolveAddress } from "../../src/core/address/resolveAddress.js";
import { FakeGeocodingProvider } from "../../src/adapters/geocoding/fake/FakeGeocodingProvider.js";
import { GeocodingUnavailableError } from "../../src/core/errors.js";

const config = { minConfidence: 0.4, maxCandidates: 3 };

describe("resolveAddress", () => {
  it("retorna not_found quando não há candidatos", async () => {
    const geocoding = new FakeGeocodingProvider();
    const result = await resolveAddress(geocoding, "endereço qualquer", config);
    expect(result).toEqual({ status: "not_found" });
  });

  it("descarta candidatos abaixo da confiança mínima", async () => {
    const geocoding = new FakeGeocodingProvider();
    geocoding.setResponseFor("endereço vago", [
      { label: "Palpite ruim", confidence: 0.1, coordinates: { lat: 0, lon: 0 } },
    ]);
    const result = await resolveAddress(geocoding, "endereço vago", config);
    expect(result).toEqual({ status: "not_found" });
  });

  it("retorna candidatos plausíveis ordenados por confiança, limitados ao máximo", async () => {
    const geocoding = new FakeGeocodingProvider();
    geocoding.setResponseFor("rua augusta", [
      { label: "Rua Augusta, 500", confidence: 0.6, coordinates: { lat: 1, lon: 1 } },
      { label: "Rua Augusta, 1000", confidence: 0.9, coordinates: { lat: 2, lon: 2 } },
      { label: "Rua Augusta, 2000", confidence: 0.5, coordinates: { lat: 3, lon: 3 } },
      { label: "Rua Augusta, 3000", confidence: 0.45, coordinates: { lat: 4, lon: 4 } },
    ]);

    const result = await resolveAddress(geocoding, "rua augusta", { minConfidence: 0.4, maxCandidates: 3 });

    expect(result.status).toBe("candidates");
    if (result.status !== "candidates") throw new Error("expected candidates");
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]!.label).toBe("Rua Augusta, 1000");
  });

  it("propaga falha do provider como GeocodingUnavailableError", async () => {
    const geocoding = new FakeGeocodingProvider();
    geocoding.setFailure(new Error("ORS indisponível"));
    await expect(resolveAddress(geocoding, "qualquer", config)).rejects.toThrow(
      GeocodingUnavailableError,
    );
  });
});
