import { describe, expect, it } from "vitest";
import { matchCatalogItem } from "../../src/core/conversation/matchCatalogItem.js";
import type { CatalogItem } from "../../src/core/catalog/types.js";

const catalog: CatalogItem[] = [
  { id: "pao-frances", name: "Pão francês", description: "", priceCents: 150, unit: "unidade", available: true },
  { id: "pao-de-forma", name: "Pão de forma integral", description: "", priceCents: 990, unit: "pacote", available: true },
  { id: "leite-integral", name: "Leite integral", description: "", priceCents: 550, unit: "litro", available: true },
  { id: "ovos-brancos", name: "Ovos brancos", description: "", priceCents: 1190, unit: "dúzia", available: true },
  { id: "queijo-minas", name: "Queijo minas frescal", description: "", priceCents: 1690, unit: "kg", available: true },
];

describe("matchCatalogItem", () => {
  it("casa nome completo com acento/plural", () => {
    expect(matchCatalogItem(catalog, "pão francês")).toEqual({ status: "matched", item: catalog[0] });
    expect(matchCatalogItem(catalog, "paes")).toEqual({ status: "ambiguous", candidates: [catalog[0], catalog[1]] });
  });

  it("é ambíguo quando o termo casa mais de um item igualmente", () => {
    const result = matchCatalogItem(catalog, "pao");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.id).sort()).toEqual(["pao-de-forma", "pao-frances"]);
    }
  });

  it("resolve item único mesmo com palavra de medida junto (litro, dúzia)", () => {
    expect(matchCatalogItem(catalog, "litro de leite")).toEqual({ status: "matched", item: catalog[2] });
    expect(matchCatalogItem(catalog, "ovos")).toEqual({ status: "matched", item: catalog[3] });
  });

  it("resolve item de nome composto com token extra que não casa com mais ninguém", () => {
    expect(matchCatalogItem(catalog, "queijo")).toEqual({ status: "matched", item: catalog[4] });
    expect(matchCatalogItem(catalog, "queijo minas")).toEqual({ status: "matched", item: catalog[4] });
  });

  it("retorna not_found para item fora do catálogo", () => {
    expect(matchCatalogItem(catalog, "refrigerante")).toEqual({ status: "not_found" });
  });

  it("retorna not_found para texto vazio ou só stopwords", () => {
    expect(matchCatalogItem(catalog, "")).toEqual({ status: "not_found" });
    expect(matchCatalogItem(catalog, "de um a")).toEqual({ status: "not_found" });
  });
});
