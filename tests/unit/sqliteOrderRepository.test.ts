import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/adapters/persistence/sqlite/openDatabase.js";
import { SqliteOrderRepository } from "../../src/adapters/persistence/sqlite/SqliteOrderRepository.js";
import type { Order } from "../../src/core/orders/types.js";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    customerId: "cliente1",
    items: [{ itemId: "pao-frances", name: "Pão francês", unit: "unidade", quantity: 2, unitPriceCents: 150, lineTotalCents: 300 }],
    subtotalCents: 300,
    shippingCents: 500,
    totalCents: 800,
    addressLabel: "Rua Teste, 100",
    addressCoordinates: { lat: -23.5, lon: -46.6 },
    distanceMeters: 2000,
    window: { date: "2026-09-03", slot: "12h" },
    confirmedAt: "2026-09-03T11:00:00.000Z",
    ...overrides,
  };
}

describe("SqliteOrderRepository", () => {
  it("salva e recupera um pedido por id, preservando itens e coordenadas", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteOrderRepository(db);
    const order = makeOrder();

    await repo.save(order);
    const found = await repo.findById("order-1");

    expect(found).toEqual(order);
  });

  it("retorna undefined para id inexistente", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteOrderRepository(db);
    expect(await repo.findById("nao-existe")).toBeUndefined();
  });

  it("lista pedidos por janela (data + slot)", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteOrderRepository(db);

    await repo.save(makeOrder({ id: "order-1", window: { date: "2026-09-03", slot: "12h" } }));
    await repo.save(makeOrder({ id: "order-2", window: { date: "2026-09-03", slot: "16h" } }));
    await repo.save(makeOrder({ id: "order-3", window: { date: "2026-09-03", slot: "12h" } }));

    const results = await repo.listByWindow("2026-09-03", "12h");
    expect(results.map((o) => o.id).sort()).toEqual(["order-1", "order-3"]);
  });

  it("sobrescreve um pedido existente com o mesmo id (upsert)", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteOrderRepository(db);

    await repo.save(makeOrder({ totalCents: 800 }));
    await repo.save(makeOrder({ totalCents: 999 }));

    const found = await repo.findById("order-1");
    expect(found?.totalCents).toBe(999);
  });
});
