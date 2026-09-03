import type { IntentParser } from "../../../ports/IntentParser.js";
import type { ParsedIntent } from "../../../core/conversation/intent.js";
import { normalize } from "./textNormalize.js";
import { extractLeadingQuantity } from "./numberWords.js";

const HUMAN_KEYWORDS = [
  "atendente",
  "humano",
  "pessoa de verdade",
  "falar com alguem",
  "quero falar com uma pessoa",
];

// Fora do escopo do bot nesta fase: reclamação, troca/cobrança, e qualquer
// coisa sobre um pedido já fechado (status, cancelamento, alteração).
const OUT_OF_SCOPE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /reclama/, reason: "Reclamação" },
  { pattern: /\btroca\b|\btrocar\b/, reason: "Pedido de troca" },
  { pattern: /cobran|cobrar|estorno|reembolso/, reason: "Questão de cobrança" },
  { pattern: /(cancelar|cancela|alterar|mudar).*pedido/, reason: "Alteração/cancelamento de pedido já fechado" },
  { pattern: /pedido.*(cancelar|cancela|alterar|mudar)/, reason: "Alteração/cancelamento de pedido já fechado" },
  { pattern: /cade (o )?meu pedido|status do (meu )?pedido|meu pedido (nao chegou|nao chegou ainda)/, reason: "Consulta de status de pedido" },
];

const CONFIRM_WORDS = new Set([
  "sim",
  "confirmo",
  "confirmar",
  "ok",
  "beleza",
  "fechado",
  "pode ser",
  "isso",
  "certo",
  "e isso",
  "e isso mesmo",
]);

const CANCEL_WORDS = new Set([
  "nao",
  "cancela",
  "cancelar",
  "desistir",
  "deixa pra la",
  "esquece",
  "nenhuma dessas",
  "nenhuma das opcoes",
]);

const REMOVE_PREFIXES = [/^tira(r)?\s+(o|a|os|as)?\s*/, /^remove(r)?\s+(o|a|os|as)?\s*/, /^tirar\s+/];

const LEADING_FILLERS = [
  "por favor",
  "eu quero",
  "queria",
  "gostaria de",
  "vou querer",
  "quero",
  "me ve",
  "me vê",
  "pode mandar",
  "manda",
  "adiciona",
  "coloca ai",
  "coloca",
];

function stripLeadingFillers(text: string): string {
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const filler of LEADING_FILLERS) {
      if (result === filler) {
        result = "";
        changed = true;
      } else if (result.startsWith(`${filler} `)) {
        result = result.slice(filler.length + 1);
        changed = true;
      }
    }
  }
  return result.trim();
}

/**
 * Parser de intenção baseado em regras/palavras-chave — sem custo, sem API
 * externa, determinístico (decisão do usuário). Limitação conhecida: entende
 * bem menos variação de linguagem natural do que um LLM real.
 */
export class RuleBasedIntentParser implements IntentParser {
  parse(rawText: string): ParsedIntent {
    const text = normalize(rawText);

    if (HUMAN_KEYWORDS.some((keyword) => text.includes(keyword))) {
      return { type: "request_human" };
    }

    for (const { pattern, reason } of OUT_OF_SCOPE_PATTERNS) {
      if (pattern.test(text)) {
        return { type: "out_of_scope", reason };
      }
    }

    const optionMatch = text.match(/^(?:opcao|opc|numero)?\s*(\d+)\s*$/);
    if (optionMatch && optionMatch[1]) {
      return { type: "select_option", index: Number(optionMatch[1]) };
    }

    if (CONFIRM_WORDS.has(text)) {
      return { type: "confirm" };
    }

    if (CANCEL_WORDS.has(text)) {
      return { type: "cancel" };
    }

    for (const prefix of REMOVE_PREFIXES) {
      const match = text.match(prefix);
      if (match) {
        const itemText = text.slice(match[0].length).trim();
        if (itemText) return { type: "remove_item", text: itemText };
      }
    }

    const withoutFillers = stripLeadingFillers(text);
    if (withoutFillers.length === 0) {
      return { type: "unclear" };
    }

    const segments = withoutFillers
      .split(/,| e | mais | tambem /)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return { type: "unclear" };
    }

    const items = segments.map((segment) => {
      const { quantity, rest } = extractLeadingQuantity(segment);
      return { text: rest, quantity };
    });

    const hasUsableItem = items.some((item) => item.text.length > 0);
    if (!hasUsableItem) {
      return { type: "unclear" };
    }

    return { type: "add_items", items: items.filter((item) => item.text.length > 0) };
  }
}
