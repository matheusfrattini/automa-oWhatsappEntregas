import { beforeEach, describe, expect, it } from "vitest";
import { addItem, createEmptyCart, removeItem, setQuantity, summarizeCart } from "../../src/core/cart/cart.js";
import { InvalidQuantityError, ItemNotFoundError, ItemUnavailableError } from "../../src/core/errors.js";
import type { CatalogRepository } from "../../src/ports/CatalogRepository.js";
import type { CatalogItem } from "../../src/core/catalog/types.js";

function makeCatalog(items: CatalogItem[]): CatalogRepository {
  return {
    async listAll() {
      return items;
    },
    async listAvailable() {
      return items.filter((i) => i.available);
    },
    async findById(id: string) {
      return items.find((i) => i.id === id);
    },
  };
}

const paoFrances: CatalogItem = {
  id: "pao-frances",
  name: "Pão francês",
  description: "Pão francês fresco",
  priceCents: 150,
  unit: "unidade",
  available: true,
};

const suco: CatalogItem = {
  id: "suco-laranja",
  name: "Suco de laranja",
  description: "Suco natural",
  priceCents: 850,
  unit: "litro",
  available: false,
};

let catalog: CatalogRepository;

beforeEach(() => {
  catalog = makeCatalog([paoFrances, suco]);
});

describe("cart", () => {
  it("adiciona item existente e disponível", async () => {
    const cart = await addItem(createEmptyCart(), catalog, "pao-frances", 2);
    expect(cart.lines).toEqual([{ itemId: "pao-frances", quantity: 2 }]);
  });

  it("soma quantidade ao adicionar item já presente", async () => {
    let cart = await addItem(createEmptyCart(), catalog, "pao-frances", 2);
    cart = await addItem(cart, catalog, "pao-frances", 3);
    expect(cart.lines).toEqual([{ itemId: "pao-frances", quantity: 5 }]);
  });

  it("rejeita item que não existe no catálogo", async () => {
    await expect(addItem(createEmptyCart(), catalog, "item-fantasma", 1)).rejects.toThrow(
      ItemNotFoundError,
    );
  });

  it("rejeita item indisponível", async () => {
    await expect(addItem(createEmptyCart(), catalog, "suco-laranja", 1)).rejects.toThrow(
      ItemUnavailableError,
    );
  });

  it("rejeita quantidade inválida (zero, negativa ou não inteira)", async () => {
    await expect(addItem(createEmptyCart(), catalog, "pao-frances", 0)).rejects.toThrow(
      InvalidQuantityError,
    );
    await expect(addItem(createEmptyCart(), catalog, "pao-frances", -1)).rejects.toThrow(
      InvalidQuantityError,
    );
    await expect(addItem(createEmptyCart(), catalog, "pao-frances", 1.5)).rejects.toThrow(
      InvalidQuantityError,
    );
  });

  it("remove item do carrinho", async () => {
    const cart = await addItem(createEmptyCart(), catalog, "pao-frances", 2);
    expect(removeItem(cart, "pao-frances").lines).toEqual([]);
  });

  it("define quantidade absoluta com setQuantity", async () => {
    let cart = await addItem(createEmptyCart(), catalog, "pao-frances", 2);
    cart = await setQuantity(cart, catalog, "pao-frances", 10);
    expect(cart.lines).toEqual([{ itemId: "pao-frances", quantity: 10 }]);
  });

  it("resume o carrinho com subtotal em centavos", async () => {
    const cart = await addItem(createEmptyCart(), catalog, "pao-frances", 4);
    const summary = await summarizeCart(cart, catalog);
    expect(summary.subtotalCents).toBe(600);
    expect(summary.lines[0]).toMatchObject({
      itemId: "pao-frances",
      quantity: 4,
      unitPriceCents: 150,
      lineTotalCents: 600,
    });
  });
});
