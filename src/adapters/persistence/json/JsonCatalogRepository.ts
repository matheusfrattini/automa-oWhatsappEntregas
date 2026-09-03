import { readFile } from "node:fs/promises";
import type { CatalogRepository } from "../../../ports/CatalogRepository.js";
import type { CatalogItem } from "../../../core/catalog/types.js";

/**
 * Lê o catálogo de um arquivo JSON. Trocar por outra fonte (banco, planilha)
 * significa escrever outra implementação de CatalogRepository — o núcleo não muda.
 */
export class JsonCatalogRepository implements CatalogRepository {
  private cache: CatalogItem[] | undefined;

  constructor(private readonly filePath: string) {}

  private async load(): Promise<CatalogItem[]> {
    if (this.cache) return this.cache;
    const raw = await readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as CatalogItem[];
    this.cache = parsed;
    return parsed;
  }

  async listAll(): Promise<CatalogItem[]> {
    return this.load();
  }

  async listAvailable(): Promise<CatalogItem[]> {
    const items = await this.load();
    return items.filter((item) => item.available);
  }

  async findById(id: string): Promise<CatalogItem | undefined> {
    const items = await this.load();
    return items.find((item) => item.id === id);
  }
}
