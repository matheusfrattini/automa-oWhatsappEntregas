import type { CatalogRepository } from "../../ports/CatalogRepository.js";
import {
  InvalidQuantityError,
  ItemNotFoundError,
  ItemUnavailableError,
} from "../errors.js";
import type { Cart, CartLine, CartSummary } from "./types.js";

export function createEmptyCart(): Cart {
  return { lines: [] };
}

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvalidQuantityError(quantity);
  }
}

async function assertItemPurchasable(
  catalog: CatalogRepository,
  itemId: string,
): Promise<void> {
  const item = await catalog.findById(itemId);
  if (!item) throw new ItemNotFoundError(itemId);
  if (!item.available) throw new ItemUnavailableError(itemId);
}

/**
 * Adiciona um item ao carrinho. Se o item já estiver no carrinho, soma a quantidade.
 * Lança se o item não existir, estiver indisponível, ou a quantidade for inválida.
 * Resolução de ambiguidade/linguagem natural acontece antes de chamar esta função
 * (camada de conversa) — aqui o itemId já está resolvido.
 */
export async function addItem(
  cart: Cart,
  catalog: CatalogRepository,
  itemId: string,
  quantity: number,
): Promise<Cart> {
  assertValidQuantity(quantity);
  await assertItemPurchasable(catalog, itemId);

  const existing = cart.lines.find((line) => line.itemId === itemId);
  const lines: CartLine[] = existing
    ? cart.lines.map((line) =>
        line.itemId === itemId
          ? { ...line, quantity: line.quantity + quantity }
          : line,
      )
    : [...cart.lines, { itemId, quantity }];

  return { lines };
}

export function removeItem(cart: Cart, itemId: string): Cart {
  return { lines: cart.lines.filter((line) => line.itemId !== itemId) };
}

/**
 * Define a quantidade absoluta de um item já no carrinho (não soma).
 */
export async function setQuantity(
  cart: Cart,
  catalog: CatalogRepository,
  itemId: string,
  quantity: number,
): Promise<Cart> {
  assertValidQuantity(quantity);
  await assertItemPurchasable(catalog, itemId);

  const exists = cart.lines.some((line) => line.itemId === itemId);
  const lines: CartLine[] = exists
    ? cart.lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line))
    : [...cart.lines, { itemId, quantity }];

  return { lines };
}

/**
 * Resume o carrinho com preços atuais do catálogo. Não é o snapshot congelado
 * do pedido — isso só acontece no fechamento (ver core/orders).
 */
export async function summarizeCart(
  cart: Cart,
  catalog: CatalogRepository,
): Promise<CartSummary> {
  const summaryLines = await Promise.all(
    cart.lines.map(async (line) => {
      const item = await catalog.findById(line.itemId);
      if (!item) throw new ItemNotFoundError(line.itemId);
      const lineTotalCents = item.priceCents * line.quantity;
      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: line.quantity,
        unitPriceCents: item.priceCents,
        lineTotalCents,
      };
    }),
  );

  const subtotalCents = summaryLines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  return { lines: summaryLines, subtotalCents };
}
