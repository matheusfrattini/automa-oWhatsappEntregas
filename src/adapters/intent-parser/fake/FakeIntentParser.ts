import type { IntentParser } from "../../../ports/IntentParser.js";
import type { ParsedIntent } from "../../../core/conversation/intent.js";

/**
 * Parser determinístico para testes de orquestração — mapeia texto exato para
 * a intenção configurada, sem depender das regras do parser real.
 */
export class FakeIntentParser implements IntentParser {
  private responses = new Map<string, ParsedIntent>();
  private defaultIntent: ParsedIntent = { type: "unclear" };

  setResponseFor(text: string, intent: ParsedIntent): void {
    this.responses.set(text, intent);
  }

  setDefault(intent: ParsedIntent): void {
    this.defaultIntent = intent;
  }

  parse(text: string): ParsedIntent {
    return this.responses.get(text) ?? this.defaultIntent;
  }
}
