import { describe, expect, it } from "vitest";
import { handleMessage, type ConversationDeps } from "../../src/core/conversation/handleMessage.js";
import { createConversation } from "../../src/core/conversation/types.js";
import { RuleBasedIntentParser } from "../../src/adapters/intent-parser/rule-based/RuleBasedIntentParser.js";
import { FakeGeocodingProvider } from "../../src/adapters/geocoding/fake/FakeGeocodingProvider.js";
import { FakeRoutingProvider } from "../../src/adapters/routing-provider/fake/FakeRoutingProvider.js";
import { InMemoryOrderRepository } from "../../src/adapters/persistence/in-memory/InMemoryOrderRepository.js";
import { FixedClock } from "../../src/adapters/clock/fake/FixedClock.js";
import { loadConfig } from "../../src/config/index.js";
import type { CatalogItem } from "../../src/core/catalog/types.js";

const catalog: CatalogItem[] = [
  { id: "pao-frances", name: "Pão francês", description: "", priceCents: 150, unit: "unidade", available: true },
  { id: "pao-de-forma", name: "Pão de forma integral", description: "", priceCents: 990, unit: "pacote", available: true },
  { id: "leite-integral", name: "Leite integral", description: "", priceCents: 550, unit: "litro", available: true },
  { id: "suco-laranja", name: "Suco de laranja", description: "", priceCents: 850, unit: "litro", available: false },
];

const baseEnv = {
  SHIPPING_BASE_FEE_CENTS: "500",
  SHIPPING_PRICE_PER_KM_CENTS: "150",
  SHIPPING_MAX_DELIVERY_RADIUS_KM: "8",
  STORE_ADDRESS: "Loja",
  STORE_LAT: "-23.5558",
  STORE_LON: "-46.662",
};
const config = loadConfig(baseEnv as unknown as NodeJS.ProcessEnv);

function makeDeps(overrides: Partial<ConversationDeps> = {}): {
  deps: ConversationDeps;
  geocoding: FakeGeocodingProvider;
  routing: FakeRoutingProvider;
  orderRepository: InMemoryOrderRepository;
} {
  const geocoding = new FakeGeocodingProvider();
  const routing = new FakeRoutingProvider();
  const orderRepository = new InMemoryOrderRepository();
  let idCounter = 0;

  const deps: ConversationDeps = {
    intentParser: new RuleBasedIntentParser(),
    geocoding,
    routing,
    orderRepository,
    clock: new FixedClock(new Date("2026-09-03T11:00:00-03:00")),
    config,
    catalog,
    generateOrderId: () => `order-${++idCounter}`,
    ...overrides,
  };

  return { deps, geocoding, routing, orderRepository };
}

async function run(deps: ConversationDeps, messages: string[]) {
  let context = createConversation("customer-1");
  const allReplies: string[][] = [];
  for (const message of messages) {
    const result = await handleMessage(context, message, deps);
    context = result.context;
    allReplies.push(result.replies);
  }
  return { context, allReplies };
}

describe("handleMessage — fluxo completo", () => {
  it("monta carrinho, confirma endereço único, calcula frete e fecha o pedido", async () => {
    const { deps, geocoding, routing, orderRepository } = makeDeps();
    geocoding.setResponseFor("rua augusta 1000", [
      { label: "Rua Augusta, 1000 - São Paulo, SP", confidence: 0.9, coordinates: { lat: -23.56, lon: -46.65 } },
    ]);
    routing.setFixedResponse({ distanceMeters: 3000, durationSeconds: 500 });

    const { context, allReplies } = await run(deps, [
      "quero 2 pão francês e 1 leite",
      "confirmar",
      "Rua Augusta 1000",
      "sim",
      "sim",
    ]);

    expect(context.isHandoff).toBe(false);
    expect(context.state).toBe("collecting_order");
    expect(context.cart.lines).toEqual([]);

    const finalReplies = allReplies[allReplies.length - 1]!;
    expect(finalReplies[0]).toContain("Pedido confirmado");
    expect(finalReplies[1]).toContain("leva das 12h");

    const orders = await orderRepository.listByWindow("2026-09-03", "12h");
    expect(orders).toHaveLength(1);
    expect(orders[0]!.subtotalCents).toBe(150 * 2 + 550);
    expect(orders[0]!.shippingCents).toBe(500 + 450); // 3km * 150 + taxa base
    expect(orders[0]!.totalCents).toBe(150 * 2 + 550 + 500 + 450);
  });

  it("pede esclarecimento em item ambíguo e continua depois de resolvido", async () => {
    const { deps } = makeDeps();
    const { allReplies } = await run(deps, ["quero pão", "pão francês"]);

    expect(allReplies[0]![0]).toMatch(/pão francês ou pão de forma/i);
    expect(allReplies[1]!.join(" ")).toContain("Adicionei 1x Pão francês");
  });

  it("avisa quando o item não existe no catálogo, sem inventar produto", async () => {
    const { deps } = makeDeps();
    const { allReplies } = await run(deps, ["quero 1 refrigerante"]);
    expect(allReplies[0]!.join(" ")).toContain('Não encontrei "refrigerante"');
  });

  it("avisa item indisponível sem adicionar ao carrinho", async () => {
    const { deps } = makeDeps();
    const { context, allReplies } = await run(deps, ["quero 1 suco de laranja"]);
    expect(allReplies[0]!.join(" ")).toContain("indisponível");
    expect(context.cart.lines).toEqual([]);
  });

  it("escala para humano quando o cliente pede atendente", async () => {
    const { deps } = makeDeps();
    const { context, allReplies } = await run(deps, ["quero falar com um atendente"]);
    expect(context.isHandoff).toBe(true);
    expect(context.handoffReason).toContain("atendente");
    expect(allReplies[0]![0]).toContain("atendente");
  });

  it("escala para humano em assunto fora do escopo (reclamação)", async () => {
    const { deps } = makeDeps();
    const { context } = await run(deps, ["quero fazer uma reclamação sobre o pedido de ontem"]);
    expect(context.isHandoff).toBe(true);
    expect(context.handoffReason).toContain("Fora do escopo");
  });

  it("escala depois de não entender duas vezes seguidas", async () => {
    const { deps } = makeDeps();
    const { context } = await run(deps, ["por favor", "por favor"]);
    expect(context.isHandoff).toBe(true);
    expect(context.handoffReason).toContain("esclarecimento");
  });

  it("para de responder automaticamente depois do handoff", async () => {
    const { deps } = makeDeps();
    let context = createConversation("customer-1");
    context = (await handleMessage(context, "quero falar com atendente", deps)).context;
    expect(context.isHandoff).toBe(true);

    const result = await handleMessage(context, "alô? alguém aí?", deps);
    expect(result.replies).toEqual([]);
    expect(result.context.isHandoff).toBe(true);
  });

  it("escala quando o geocoding falha, sem inventar coordenada", async () => {
    const { deps, geocoding } = makeDeps();
    geocoding.setFailure(new Error("ORS fora do ar"));

    const { context } = await run(deps, ["quero 1 leite", "confirmar", "Rua Augusta 1000"]);
    expect(context.isHandoff).toBe(true);
    expect(context.handoffReason).toContain("geocoding");
  });

  it("escala quando o roteamento falha ao calcular frete, sem inventar valor", async () => {
    const { deps, geocoding, routing } = makeDeps();
    geocoding.setResponseFor("rua augusta 1000", [
      { label: "Rua Augusta, 1000", confidence: 0.9, coordinates: { lat: -23.56, lon: -46.65 } },
    ]);
    routing.setFailure(new Error("ORS timeout"));

    const { context } = await run(deps, ["quero 1 leite", "confirmar", "Rua Augusta 1000", "sim"]);
    expect(context.isHandoff).toBe(true);
    expect(context.handoffReason).toContain("roteamento");
  });

  it("recusa educadamente endereço fora do raio máximo e permite tentar outro", async () => {
    const { deps, geocoding, routing } = makeDeps();
    geocoding.setResponseFor("endereco longe", [
      { label: "Endereço Longe", confidence: 0.9, coordinates: { lat: -24.0, lon: -47.0 } },
    ]);
    routing.setFixedResponse({ distanceMeters: 20000, durationSeconds: 1800 });

    const { context, allReplies } = await run(deps, ["quero 1 leite", "confirmar", "endereco longe", "sim"]);
    expect(allReplies[3]!.join(" ")).toContain("fora da nossa área de entrega");
    expect(context.state).toBe("awaiting_address");
    expect(context.isHandoff).toBe(false);
  });

  it("oferece múltiplos candidatos de endereço e aceita seleção por número", async () => {
    const { deps, geocoding, routing } = makeDeps();
    geocoding.setResponseFor("rua augusta", [
      { label: "Rua Augusta, 100", confidence: 0.9, coordinates: { lat: -23.56, lon: -46.65 } },
      { label: "Rua Augusta, 200", confidence: 0.85, coordinates: { lat: -23.57, lon: -46.66 } },
    ]);
    routing.setFixedResponse({ distanceMeters: 1000, durationSeconds: 200 });

    const { allReplies } = await run(deps, ["quero 1 leite", "confirmar", "rua augusta", "2"]);
    expect(allReplies[2]!.join(" ")).toContain("Rua Augusta, 100");
    expect(allReplies[3]!.join(" ")).toContain("Rua Augusta, 200");
  });

  it("permite editar o carrinho depois do resumo, antes da confirmação final", async () => {
    const { deps, geocoding, routing } = makeDeps();
    geocoding.setResponseFor("rua augusta 1000", [
      { label: "Rua Augusta, 1000", confidence: 0.9, coordinates: { lat: -23.56, lon: -46.65 } },
    ]);
    routing.setFixedResponse({ distanceMeters: 1000, durationSeconds: 200 });

    const { context, allReplies } = await run(deps, [
      "quero 1 leite",
      "confirmar",
      "Rua Augusta 1000",
      "sim",
      "quero mais 1 pão francês",
    ]);

    expect(context.state).toBe("confirming_order");
    const lastReply = allReplies[allReplies.length - 1]!.join(" ");
    expect(lastReply).toContain("Pão francês");
    expect(lastReply).toContain("Confirma o pedido?");
  });

  it("pedidos confirmados depois das 15h40 entram na leva das 12h do dia seguinte", async () => {
    const { deps, geocoding, routing, orderRepository } = makeDeps({
      clock: new FixedClock(new Date("2026-09-03T15:41:00-03:00")),
    });
    geocoding.setResponseFor("rua augusta 1000", [
      { label: "Rua Augusta, 1000", confidence: 0.9, coordinates: { lat: -23.56, lon: -46.65 } },
    ]);
    routing.setFixedResponse({ distanceMeters: 1000, durationSeconds: 200 });

    await run(deps, ["quero 1 leite", "confirmar", "Rua Augusta 1000", "sim", "sim"]);

    const ordersNextDay = await orderRepository.listByWindow("2026-09-04", "12h");
    expect(ordersNextDay).toHaveLength(1);
  });
});
