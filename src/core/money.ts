import type { Cents } from "./types.js";

/** Formata centavos como BRL para exibição. Nunca usado em cálculo, só em texto. */
export function formatCentsAsBRL(cents: Cents): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
