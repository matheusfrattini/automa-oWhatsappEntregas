import type { ConversationContext } from "../core/conversation/types.js";

export interface ConversationRepository {
  get(customerId: string): Promise<ConversationContext | undefined>;
  save(context: ConversationContext): Promise<void>;
}
