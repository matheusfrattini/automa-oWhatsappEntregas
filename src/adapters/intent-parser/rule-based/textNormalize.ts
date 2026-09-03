const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/** Minúsculas, sem acento, espaços colapsados. Usado por todo o parser baseado em regras. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
