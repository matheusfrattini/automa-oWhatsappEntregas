import type { ConversationContext } from "../core/conversation/types.js";

export interface ConversationRepository {
  get(customerId: string): Promise<ConversationContext | undefined>;
  save(context: ConversationContext): Promise<void>;
  /** Conversas em handoff — usado pelo painel de atendente do simulador. */
  listHandoff(): Promise<ConversationContext[]>;
}
