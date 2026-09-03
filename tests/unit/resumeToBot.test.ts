import { describe, expect, it } from "vitest";
import { createConversation } from "../../src/core/conversation/types.js";
import { resumeToBot } from "../../src/core/conversation/resumeToBot.js";

describe("resumeToBot", () => {
  it("desliga o handoff e limpa o motivo, mantendo carrinho e estado", async () => {
    const context = {
      ...createConversation("customer-1"),
      isHandoff: true,
      handoffReason: "Cliente pediu atendente",
      state: "awaiting_address" as const,
    };

    const resumed = resumeToBot(context);

    expect(resumed.isHandoff).toBe(false);
    expect(resumed.handoffReason).toBeUndefined();
    expect(resumed.state).toBe("awaiting_address");
    expect(resumed.consecutiveUnclearCount).toBe(0);
  });
});
