import type { ConversationRepository } from "../../../ports/ConversationRepository.js";
import type { ConversationContext } from "../../../core/conversation/types.js";

/**
 * Guarda conversas em memória. Suficiente para o simulador; trocar por
 * persistência real (SQLite) é escrever outra implementação desta porta.
 */
export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, ConversationContext>();

  async get(customerId: string): Promise<ConversationContext | undefined> {
    return this.conversations.get(customerId);
  }

  async save(context: ConversationContext): Promise<void> {
    this.conversations.set(context.customerId, context);
  }
}
