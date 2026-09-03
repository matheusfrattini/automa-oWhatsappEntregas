import type { ParsedIntent } from "../core/conversation/intent.js";

/**
 * Porta para interpretar a mensagem do cliente. Implementação desta fase é
 * baseada em regras/palavras-chave (decisão do usuário: sem custo, sem API
 * externa). Pode ser trocada por um adapter baseado em LLM depois, escrevendo
 * outra implementação desta porta — o núcleo não muda.
 */
export interface IntentParser {
  parse(text: string): ParsedIntent;
}
