import { describe, expect, it } from "vitest";
import { RuleBasedIntentParser } from "../../src/adapters/intent-parser/rule-based/RuleBasedIntentParser.js";

const parser = new RuleBasedIntentParser();

describe("RuleBasedIntentParser", () => {
  it("interpreta o exemplo do briefing: 'me vê dois pães e um litro de leite'", () => {
    const result = parser.parse("me vê dois pães e um litro de leite");
    expect(result).toEqual({
      type: "add_items",
      items: [
        { text: "paes", quantity: 2 },
        { text: "litro de leite", quantity: 1 },
      ],
    });
  });

  it("entende quantidade em dígito e dúzia", () => {
    expect(parser.parse("quero 3 pão de forma")).toEqual({
      type: "add_items",
      items: [{ text: "pao de forma", quantity: 3 }],
    });
    expect(parser.parse("uma dúzia de ovos")).toEqual({
      type: "add_items",
      items: [{ text: "ovos", quantity: 12 }],
    });
    expect(parser.parse("meia dúzia de ovos")).toEqual({
      type: "add_items",
      items: [{ text: "ovos", quantity: 6 }],
    });
  });

  it("detecta pedido de atendente humano", () => {
    expect(parser.parse("quero falar com um atendente")).toEqual({ type: "request_human" });
    expect(parser.parse("Quero falar com uma pessoa de verdade")).toEqual({ type: "request_human" });
  });

  it("detecta assuntos fora do escopo do bot", () => {
    expect(parser.parse("quero fazer uma reclamação").type).toBe("out_of_scope");
    expect(parser.parse("quero trocar um item").type).toBe("out_of_scope");
    expect(parser.parse("cadê meu pedido").type).toBe("out_of_scope");
    expect(parser.parse("quero cancelar meu pedido").type).toBe("out_of_scope");
  });

  it("detecta confirmação e cancelamento", () => {
    expect(parser.parse("sim")).toEqual({ type: "confirm" });
    expect(parser.parse("confirmo")).toEqual({ type: "confirm" });
    expect(parser.parse("não")).toEqual({ type: "cancel" });
    expect(parser.parse("cancela")).toEqual({ type: "cancel" });
  });

  it("detecta seleção de opção numérica", () => {
    expect(parser.parse("2")).toEqual({ type: "select_option", index: 2 });
    expect(parser.parse("opção 1")).toEqual({ type: "select_option", index: 1 });
  });

  it("detecta remoção de item", () => {
    expect(parser.parse("tira o pão francês")).toEqual({ type: "remove_item", text: "pao frances" });
    expect(parser.parse("remove o leite")).toEqual({ type: "remove_item", text: "leite" });
  });

  it("retorna unclear quando não sobra nome de item depois de tirar preenchimento/quantidade", () => {
    expect(parser.parse("quero 2")).toEqual({ type: "unclear" });
    expect(parser.parse("por favor")).toEqual({ type: "unclear" });
  });
});
