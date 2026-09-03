import type { CatalogItem } from "../core/catalog/types.js";

/**
 * Porta para acesso ao catálogo. O núcleo depende só disso — nunca de onde
 * os dados vêm (arquivo, banco, etc).
 */
export interface CatalogRepository {
  listAvailable(): Promise<CatalogItem[]>;
  listAll(): Promise<CatalogItem[]>;
  findById(id: string): Promise<CatalogItem | undefined>;
}
