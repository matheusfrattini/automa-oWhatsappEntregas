import type { CatalogItem } from "../catalog/types.js";

export type ItemMatchResult =
  | { status: "matched"; item: CatalogItem }
  | { status: "ambiguous"; candidates: CatalogItem[] }
  | { status: "not_found" };

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "um", "uma", "o", "a", "os", "as"]);

/**
 * Plurais irregulares comuns no catálogo (não seguem a regra genérica de
 * remover o "s" final). Limitação conhecida do parser baseado em regras —
 * um LLM lidaria com isso naturalmente.
 */
const IRREGULAR_ALIASES: Record<string, string> = {
  paes: "pao",
  pao: "pao",
};

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function stem(word: string): string {
  const aliased = IRREGULAR_ALIASES[word] ?? word;
  if (aliased.length > 3 && aliased.endsWith("s")) return aliased.slice(0, -1);
  return aliased;
}

function tokenize(text: string): string[] {
  const normalized = text.normalize("NFD").replace(COMBINING_DIACRITICS, "").toLowerCase();
  return normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token))
    .map(stem);
}

/**
 * Resolve um texto livre (ex: "pão", "pão francês", "leite") contra o catálogo.
 * Ambíguo quando mais de um item empata no maior número de tokens em comum
 * (ex: "pão" sozinho casa com "pão francês" e "pão de forma") — quem chama
 * decide como pedir esclarecimento, esta função não escolhe por conta própria.
 */
export function matchCatalogItem(catalog: CatalogItem[], query: string): ItemMatchResult {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return { status: "not_found" };

  const scored = catalog
    .map((item) => {
      const nameTokens = new Set(tokenize(item.name));
      let overlap = 0;
      for (const token of queryTokens) {
        if (nameTokens.has(token)) overlap++;
      }
      return { item, overlap, nameTokenCount: nameTokens.size };
    })
    .filter((scoredItem) => scoredItem.overlap > 0);

  if (scored.length === 0) return { status: "not_found" };

  const maxOverlap = Math.max(...scored.map((s) => s.overlap));
  const best = scored.filter((s) => s.overlap === maxOverlap);

  if (best.length === 1) return { status: "matched", item: best[0]!.item };

  // Desempate: se exatamente um candidato casa TODOS os tokens do próprio nome
  // (é o match mais específico), prefira ele em vez de pedir esclarecimento.
  const fullMatches = best.filter((s) => s.overlap === s.nameTokenCount);
  if (fullMatches.length === 1) return { status: "matched", item: fullMatches[0]!.item };

  return { status: "ambiguous", candidates: best.map((s) => s.item) };
}
