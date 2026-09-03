import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonCatalogRepository } from "../../src/adapters/persistence/json/JsonCatalogRepository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(__dirname, "../../data/catalog.json");

describe("JsonCatalogRepository", () => {
  it("lista os 10 itens do catálogo", async () => {
    const repo = new JsonCatalogRepository(catalogPath);
    const all = await repo.listAll();
    expect(all).toHaveLength(10);
  });

  it("lista apenas itens disponíveis", async () => {
    const repo = new JsonCatalogRepository(catalogPath);
    const available = await repo.listAvailable();
    expect(available.every((item) => item.available)).toBe(true);
    expect(available.find((item) => item.id === "suco-laranja")).toBeUndefined();
  });

  it("encontra item por id", async () => {
    const repo = new JsonCatalogRepository(catalogPath);
    const item = await repo.findById("pao-frances");
    expect(item?.name).toBe("Pão francês");
  });

  it("retorna undefined para id inexistente", async () => {
    const repo = new JsonCatalogRepository(catalogPath);
    expect(await repo.findById("nao-existe")).toBeUndefined();
  });
});
