const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
};

/**
 * Extrai a quantidade no início de um texto normalizado (dígito ou palavra em
 * português, incluindo "dúzia"/"meia dúzia"). Retorna a quantidade (default 1
 * se nada for encontrado) e o restante do texto sem o token de quantidade.
 */
export function extractLeadingQuantity(normalizedText: string): { quantity: number; rest: string } {
  const trimmed = normalizedText.trim();

  const meiaDuziaMatch = trimmed.match(/^meia[\s-]?duzia\s*(?:de\s+)?/);
  if (meiaDuziaMatch) {
    return { quantity: 6, rest: trimmed.slice(meiaDuziaMatch[0].length) };
  }

  const duziaMatch = trimmed.match(/^(?:uma?\s+)?duzia\s*(?:de\s+)?/);
  if (duziaMatch) {
    return { quantity: 12, rest: trimmed.slice(duziaMatch[0].length) };
  }

  const digitMatch = trimmed.match(/^(\d+)\s*(?:de\s+)?/);
  if (digitMatch) {
    return { quantity: Number(digitMatch[1]), rest: trimmed.slice(digitMatch[0].length) };
  }

  const wordMatch = trimmed.match(/^([a-z]+)\s+/);
  if (wordMatch && wordMatch[1] && wordMatch[1] in NUMBER_WORDS) {
    let rest = trimmed.slice(wordMatch[0].length);
    if (rest.startsWith("de ")) rest = rest.slice(3);
    return { quantity: NUMBER_WORDS[wordMatch[1]]!, rest };
  }

  return { quantity: 1, rest: trimmed };
}
