import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/index.js";

const baseEnv = {
  SHIPPING_BASE_FEE_CENTS: "500",
  SHIPPING_PRICE_PER_KM_CENTS: "150",
  SHIPPING_MAX_DELIVERY_RADIUS_KM: "8",
  STORE_ADDRESS: "Rua Teste, 123",
  STORE_LAT: "-23.5",
  STORE_LON: "-46.6",
};

describe("loadConfig", () => {
  it("carrega configuração a partir das env vars", () => {
    const config = loadConfig(baseEnv as NodeJS.ProcessEnv);
    expect(config.shipping).toEqual({
      baseFeeCents: 500,
      pricePerKmCents: 150,
      maxDeliveryRadiusKm: 8,
    });
    expect(config.store.address).toBe("Rua Teste, 123");
    expect(config.timezone).toBe("America/Sao_Paulo");
    expect(config.windows).toEqual([
      { id: "12h", time: "12:00", cutoff: "11:40" },
      { id: "16h", time: "16:00", cutoff: "15:40" },
    ]);
  });

  it("lança erro claro quando falta uma env var obrigatória", () => {
    const { SHIPPING_BASE_FEE_CENTS, ...rest } = baseEnv;
    expect(() => loadConfig(rest as unknown as NodeJS.ProcessEnv)).toThrow(
      /SHIPPING_BASE_FEE_CENTS/,
    );
  });

  it("lança erro quando env var numérica não é um número", () => {
    const env = { ...baseEnv, SHIPPING_BASE_FEE_CENTS: "abc" };
    expect(() => loadConfig(env as NodeJS.ProcessEnv)).toThrow(/must be a number/);
  });
});
