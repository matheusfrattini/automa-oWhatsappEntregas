import type { IntentParser } from "../../ports/IntentParser.js";
import type { GeocodingProvider } from "../../ports/GeocodingProvider.js";
import type { RoutingProvider } from "../../ports/RoutingProvider.js";
import type { OrderRepository } from "../../ports/OrderRepository.js";
import type { Clock } from "../../ports/Clock.js";
import type { CatalogItem } from "../catalog/types.js";
import type { AppConfig } from "../../config/index.js";
import { addItem, removeItem as removeCartItem, summarizeCart } from "../cart/cart.js";
import { matchCatalogItem } from "./matchCatalogItem.js";
import { resolveAddress } from "../address/resolveAddress.js";
import { calculateShipping } from "../shipping/calculateShipping.js";
import { DateTime } from "luxon";
import { assignDeliveryWindow } from "../delivery-window/assignWindow.js";
import { formatCentsAsBRL } from "../money.js";
import {
  GeocodingUnavailableError,
  ItemNotFoundError,
  ItemUnavailableError,
  OutOfDeliveryRadiusError,
  RoutingUnavailableError,
} from "../errors.js";
import type { ParsedIntent, RequestedItem } from "./intent.js";
import type { ConversationContext } from "./types.js";

export interface ConversationDeps {
  intentParser: IntentParser;
  geocoding: GeocodingProvider;
  routing: RoutingProvider;
  orderRepository: OrderRepository;
  clock: Clock;
  config: AppConfig;
  catalog: CatalogItem[];
  generateOrderId: () => string;
}

export interface ConversationResult {
  context: ConversationContext;
  replies: string[];
}

const HANDOFF_MESSAGE = "Vou chamar um atendente para te ajudar com isso, só um instante.";

function escalate(context: ConversationContext, reason: string, message = HANDOFF_MESSAGE): ConversationResult {
  return {
    context: { ...context, isHandoff: true, handoffReason: reason },
    replies: [message],
  };
}

function withResetUnclear(context: ConversationContext): ConversationContext {
  return { ...context, consecutiveUnclearCount: 0 };
}

async function describeCart(context: ConversationContext, catalog: CatalogItem[]): Promise<string> {
  const summary = await summarizeCart(context.cart, makeCatalogRepo(catalog));
  if (summary.lines.length === 0) return "Seu carrinho está vazio.";
  const lines = summary.lines.map(
    (line) => `- ${line.quantity}x ${line.name} (${formatCentsAsBRL(line.lineTotalCents)})`,
  );
  return `Seu carrinho:\n${lines.join("\n")}\nSubtotal: ${formatCentsAsBRL(summary.subtotalCents)}`;
}

function makeCatalogRepo(catalog: CatalogItem[]) {
  return {
    async listAll() {
      return catalog;
    },
    async listAvailable() {
      return catalog.filter((i) => i.available);
    },
    async findById(id: string) {
      return catalog.find((i) => i.id === id);
    },
  };
}

/**
 * Aplica uma lista de itens pedidos ao carrinho, resolvendo cada um contra o
 * catálogo. Retorna mensagens sobre o que precisa de esclarecimento (item
 * ambíguo ou inexistente) — nunca adiciona um item que não foi resolvido com
 * confiança.
 */
async function applyRequestedItems(
  context: ConversationContext,
  requestedItems: RequestedItem[],
  catalog: CatalogItem[],
): Promise<{ context: ConversationContext; notes: string[] }> {
  let cart = context.cart;
  const notes: string[] = [];
  const catalogRepo = makeCatalogRepo(catalog);

  for (const requested of requestedItems) {
    const match = matchCatalogItem(catalog, requested.text);
    if (match.status === "matched") {
      if (!match.item.available) {
        notes.push(`"${match.item.name}" está indisponível no momento.`);
        continue;
      }
      cart = await addItem(cart, catalogRepo, match.item.id, requested.quantity);
      notes.push(`Adicionei ${requested.quantity}x ${match.item.name}.`);
    } else if (match.status === "ambiguous") {
      const options = match.candidates.map((c) => c.name).join(" ou ");
      notes.push(`Você quis dizer ${options}? Me diga o nome certinho.`);
    } else {
      notes.push(`Não encontrei "${requested.text}" no nosso catálogo.`);
    }
  }

  return { context: { ...context, cart }, notes };
}

async function handleCollectingOrder(
  context: ConversationContext,
  intent: ParsedIntent,
  deps: ConversationDeps,
): Promise<ConversationResult> {
  if (intent.type === "add_items") {
    const { context: updated, notes } = await applyRequestedItems(context, intent.items, deps.catalog);
    const cartSummary = await describeCart(updated, deps.catalog);
    return { context: withResetUnclear(updated), replies: [...notes, cartSummary] };
  }

  if (intent.type === "remove_item") {
    const match = matchCatalogItem(deps.catalog, intent.text);
    if (match.status !== "matched") {
      return {
        context: withResetUnclear(context),
        replies: [`Não encontrei "${intent.text}" no seu carrinho.`],
      };
    }
    const updatedCart = removeCartItem(context.cart, match.item.id);
    const updated = { ...context, cart: updatedCart };
    return {
      context: withResetUnclear(updated),
      replies: [`Removi ${match.item.name}.`, await describeCart(updated, deps.catalog)],
    };
  }

  if (intent.type === "cancel") {
    const updated = { ...context, cart: { lines: [] } };
    return { context: withResetUnclear(updated), replies: ["Carrinho esvaziado. Pode pedir de novo quando quiser."] };
  }

  if (intent.type === "confirm") {
    const summary = await summarizeCart(context.cart, makeCatalogRepo(deps.catalog));
    if (summary.lines.length === 0) {
      return {
        context: withResetUnclear(context),
        replies: ["Seu carrinho está vazio. Me diga o que você quer pedir primeiro."],
      };
    }
    const updated = { ...context, state: "awaiting_address" as const };
    return {
      context: withResetUnclear(updated),
      replies: ["Show! Qual o endereço de entrega?"],
    };
  }

  return handleUnclear(context, "Não entendi. Me diga o que você quer pedir, ex: \"2 pães e 1 leite\".");
}

async function handleAwaitingAddress(
  context: ConversationContext,
  rawText: string,
  intent: ParsedIntent,
  deps: ConversationDeps,
): Promise<ConversationResult> {
  if (intent.type === "cancel") {
    return {
      context: withResetUnclear({ ...context, state: "collecting_order" }),
      replies: ["Ok, voltando para o carrinho.", await describeCart(context, deps.catalog)],
    };
  }

  let resolution;
  try {
    resolution = await resolveAddress(deps.geocoding, rawText, deps.config.address);
  } catch (cause) {
    if (cause instanceof GeocodingUnavailableError) {
      return escalate(context, "Falha técnica: geocoding indisponível ao resolver endereço");
    }
    throw cause;
  }

  if (resolution.status === "not_found") {
    if (context.addressAttempts >= 1) {
      return escalate(context, "Não conseguiu geocodificar o endereço após nova tentativa");
    }
    return {
      context: { ...context, addressAttempts: context.addressAttempts + 1 },
      replies: ["Não encontrei esse endereço. Pode mandar com número, bairro e CEP?"],
    };
  }

  const updated = { ...context, pendingAddressCandidates: resolution.candidates, state: "confirming_address" as const };

  if (resolution.candidates.length === 1) {
    const candidate = resolution.candidates[0]!;
    return {
      context: withResetUnclear(updated),
      replies: [`Encontrei este endereço: ${candidate.label}. Confirma? (sim/não)`],
    };
  }

  const options = resolution.candidates.map((c, i) => `${i + 1}. ${c.label}`).join("\n");
  return {
    context: withResetUnclear(updated),
    replies: [`Encontrei mais de um endereço possível:\n${options}\nQual deles é o seu? (responda com o número)`],
  };
}

async function confirmAddressAndQuoteShipping(
  context: ConversationContext,
  candidateIndex: number,
  deps: ConversationDeps,
): Promise<ConversationResult> {
  const candidate = context.pendingAddressCandidates[candidateIndex];
  if (!candidate) {
    return {
      context: withResetUnclear(context),
      replies: ["Não achei essa opção. Responda com o número de uma das opções que mandei."],
    };
  }

  const confirmedAddress = { label: candidate.label, coordinates: candidate.coordinates };

  let quote;
  try {
    quote = await calculateShipping(
      deps.routing,
      { lat: deps.config.store.lat, lon: deps.config.store.lon },
      confirmedAddress.coordinates,
      deps.config.shipping,
    );
  } catch (cause) {
    if (cause instanceof OutOfDeliveryRadiusError) {
      return {
        context: withResetUnclear({ ...context, state: "awaiting_address", pendingAddressCandidates: [] }),
        replies: [
          "Esse endereço está fora da nossa área de entrega. Tem outro endereço, ou é só esse mesmo?",
        ],
      };
    }
    if (cause instanceof RoutingUnavailableError) {
      return escalate(context, "Falha técnica: roteamento indisponível ao calcular frete");
    }
    throw cause;
  }

  const updated = {
    ...context,
    confirmedAddress,
    shippingQuote: quote,
    state: "confirming_order" as const,
    pendingAddressCandidates: [],
  };

  const orderSummary = await describeOrderSummary(updated, deps.catalog);
  return { context: withResetUnclear(updated), replies: [orderSummary] };
}

async function handleConfirmingAddress(
  context: ConversationContext,
  intent: ParsedIntent,
  deps: ConversationDeps,
): Promise<ConversationResult> {
  if (intent.type === "select_option") {
    return confirmAddressAndQuoteShipping(context, intent.index - 1, deps);
  }

  if (intent.type === "confirm" && context.pendingAddressCandidates.length === 1) {
    return confirmAddressAndQuoteShipping(context, 0, deps);
  }

  if (intent.type === "cancel") {
    if (context.addressAttempts >= 1) {
      return escalate(context, "Cliente rejeitou candidatos de endereço mais de uma vez");
    }
    return {
      context: { ...context, state: "awaiting_address", addressAttempts: context.addressAttempts + 1, pendingAddressCandidates: [] },
      replies: ["Sem problema. Pode mandar o endereço de novo, com mais detalhes?"],
    };
  }

  return handleUnclear(context, "Não entendi. Responda com o número da opção, ou \"sim\"/\"não\".");
}

async function describeOrderSummary(context: ConversationContext, catalog: CatalogItem[]): Promise<string> {
  const summary = await summarizeCart(context.cart, makeCatalogRepo(catalog));
  const lines = summary.lines.map((line) => `- ${line.quantity}x ${line.name}`);
  const quote = context.shippingQuote!;
  const totalCents = summary.subtotalCents + quote.shippingCents;
  return [
    `Endereço: ${context.confirmedAddress!.label}`,
    ...lines,
    `Subtotal: ${formatCentsAsBRL(summary.subtotalCents)}`,
    `Frete: ${formatCentsAsBRL(quote.shippingCents)}`,
    `Total: ${formatCentsAsBRL(totalCents)}`,
    "Confirma o pedido? (sim/não)",
  ].join("\n");
}

async function handleConfirmingOrder(
  context: ConversationContext,
  intent: ParsedIntent,
  deps: ConversationDeps,
): Promise<ConversationResult> {
  if (intent.type === "add_items") {
    const { context: updated, notes } = await applyRequestedItems(context, intent.items, deps.catalog);
    const orderSummary = await describeOrderSummary(updated, deps.catalog);
    return { context: withResetUnclear(updated), replies: [...notes, orderSummary] };
  }

  if (intent.type === "remove_item") {
    const match = matchCatalogItem(deps.catalog, intent.text);
    if (match.status !== "matched") {
      return { context: withResetUnclear(context), replies: [`Não encontrei "${intent.text}" no seu carrinho.`] };
    }
    const updated = { ...context, cart: removeCartItem(context.cart, match.item.id) };
    const orderSummary = await describeOrderSummary(updated, deps.catalog);
    return { context: withResetUnclear(updated), replies: [`Removi ${match.item.name}.`, orderSummary] };
  }

  if (intent.type === "cancel") {
    const updated = createFreshFromCancelledDraft(context);
    return { context: withResetUnclear(updated), replies: ["Pedido cancelado antes de fechar. Pode começar de novo quando quiser."] };
  }

  if (intent.type === "confirm") {
    const summary = await summarizeCart(context.cart, makeCatalogRepo(deps.catalog));
    const quote = context.shippingQuote!;
    const now = deps.clock.now();
    const window = assignDeliveryWindow(now, deps.config);

    const order = {
      id: deps.generateOrderId(),
      customerId: context.customerId,
      items: summary.lines.map((line) => ({
        itemId: line.itemId,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: line.lineTotalCents,
      })),
      subtotalCents: summary.subtotalCents,
      shippingCents: quote.shippingCents,
      totalCents: summary.subtotalCents + quote.shippingCents,
      addressLabel: context.confirmedAddress!.label,
      addressCoordinates: context.confirmedAddress!.coordinates,
      distanceMeters: quote.distanceMeters,
      window,
      confirmedAt: now.toISOString(),
    };

    await deps.orderRepository.save(order);

    const todayInStoreTimezone = DateTime.fromJSDate(now, { zone: deps.config.timezone }).toISODate();
    const windowLabel = window.slot === "12h" ? "leva das 12h" : "leva das 16h";
    const dayLabel = window.date === todayInStoreTimezone ? "hoje" : "amanhã";

    const fresh = createFreshFromCancelledDraft(context);
    return {
      context: withResetUnclear(fresh),
      replies: [
        `Pedido confirmado! Total: ${formatCentsAsBRL(order.totalCents)}.`,
        `Sua entrega está prevista para a ${windowLabel} de ${dayLabel}.`,
      ],
    };
  }

  return handleUnclear(context, "Não entendi. Responda \"sim\" para confirmar o pedido ou \"não\" para cancelar.");
}

function createFreshFromCancelledDraft(context: ConversationContext): ConversationContext {
  return {
    customerId: context.customerId,
    state: "collecting_order",
    cart: { lines: [] },
    pendingAddressCandidates: [],
    addressAttempts: 0,
    consecutiveUnclearCount: 0,
    isHandoff: false,
  };
}

function handleUnclear(context: ConversationContext, clarificationMessage: string): ConversationResult {
  if (context.consecutiveUnclearCount >= 1) {
    return escalate(context, "Não entendeu o cliente mesmo após pedir esclarecimento");
  }
  return {
    context: { ...context, consecutiveUnclearCount: context.consecutiveUnclearCount + 1 },
    replies: [clarificationMessage],
  };
}

/**
 * Ponto de entrada da camada de conversa. Nunca inventa item/preço/prazo/frete
 * que não venha do sistema; qualquer falha técnica leva a escalonamento, não a
 * uma estimativa.
 */
export async function handleMessage(
  context: ConversationContext,
  rawText: string,
  deps: ConversationDeps,
): Promise<ConversationResult> {
  if (context.isHandoff) {
    return { context, replies: [] };
  }

  const intent = deps.intentParser.parse(rawText);

  if (intent.type === "request_human") {
    return escalate(context, "Cliente pediu para falar com atendente");
  }

  if (intent.type === "out_of_scope") {
    return escalate(context, `Fora do escopo do bot: ${intent.reason}`);
  }

  switch (context.state) {
    case "collecting_order":
      return handleCollectingOrder(context, intent, deps);
    case "awaiting_address":
      return handleAwaitingAddress(context, rawText, intent, deps);
    case "confirming_address":
      return handleConfirmingAddress(context, intent, deps);
    case "confirming_order":
      return handleConfirmingOrder(context, intent, deps);
  }
}
