import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/adapters/persistence/sqlite/openDatabase.js";
import { SqliteConversationRepository } from "../../src/adapters/persistence/sqlite/SqliteConversationRepository.js";
import { createConversation } from "../../src/core/conversation/types.js";

describe("SqliteConversationRepository", () => {
  it("salva e recupera uma conversa, preservando carrinho e estado", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteConversationRepository(db);

    const context = {
      ...createConversation("cliente1"),
      state: "confirming_order" as const,
      cart: { lines: [{ itemId: "pao-frances", quantity: 2 }] },
      confirmedAddress: { label: "Rua Teste, 100", coordinates: { lat: -23.5, lon: -46.6 } },
      shippingQuote: { distanceMeters: 2000, durationSeconds: 300, shippingCents: 800 },
    };

    await repo.save(context);
    const found = await repo.get("cliente1");

    expect(found).toEqual(context);
  });

  it("retorna undefined para cliente sem conversa", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteConversationRepository(db);
    expect(await repo.get("desconhecido")).toBeUndefined();
  });

  it("lista apenas conversas em handoff", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteConversationRepository(db);

    await repo.save({ ...createConversation("cliente1"), isHandoff: true, handoffReason: "pediu atendente" });
    await repo.save({ ...createConversation("cliente2"), isHandoff: false });

    const handoffs = await repo.listHandoff();
    expect(handoffs.map((c) => c.customerId)).toEqual(["cliente1"]);
    expect(handoffs[0]!.handoffReason).toBe("pediu atendente");
  });

  it("upsert: salvar de novo para o mesmo cliente atualiza a conversa", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteConversationRepository(db);

    await repo.save({ ...createConversation("cliente1"), state: "collecting_order" });
    await repo.save({ ...createConversation("cliente1"), state: "awaiting_address" });

    const found = await repo.get("cliente1");
    expect(found?.state).toBe("awaiting_address");
  });
});
