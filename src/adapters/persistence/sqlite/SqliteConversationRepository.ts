import type { DatabaseSync } from "./sqliteModule.js";
import type { ConversationRepository } from "../../../ports/ConversationRepository.js";
import type { ConversationContext, ConversationState } from "../../../core/conversation/types.js";

interface ConversationRow {
  customer_id: string;
  state: string;
  cart_json: string;
  pending_address_candidates_json: string;
  address_attempts: number;
  confirmed_address_json: string | null;
  shipping_quote_json: string | null;
  consecutive_unclear_count: number;
  is_handoff: number;
  handoff_reason: string | null;
}

function rowToContext(row: ConversationRow): ConversationContext {
  return {
    customerId: row.customer_id,
    state: row.state as ConversationState,
    cart: JSON.parse(row.cart_json),
    pendingAddressCandidates: JSON.parse(row.pending_address_candidates_json),
    addressAttempts: row.address_attempts,
    consecutiveUnclearCount: row.consecutive_unclear_count,
    isHandoff: row.is_handoff === 1,
    ...(row.confirmed_address_json ? { confirmedAddress: JSON.parse(row.confirmed_address_json) } : {}),
    ...(row.shipping_quote_json ? { shippingQuote: JSON.parse(row.shipping_quote_json) } : {}),
    ...(row.handoff_reason ? { handoffReason: row.handoff_reason } : {}),
  };
}

/**
 * Persistência real de conversas via node:sqlite. Estado é guardado como JSON
 * por coluna relevante — schema simples de propósito, sem normalizar carrinho
 * em tabelas próprias (não precisamos disso nesta fase).
 */
export class SqliteConversationRepository implements ConversationRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(customerId: string): Promise<ConversationContext | undefined> {
    const row = this.db
      .prepare("SELECT * FROM conversations WHERE customer_id = ?")
      .get(customerId) as unknown as ConversationRow | undefined;
    return row ? rowToContext(row) : undefined;
  }

  async save(context: ConversationContext): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO conversations (
          customer_id, state, cart_json, pending_address_candidates_json, address_attempts,
          confirmed_address_json, shipping_quote_json, consecutive_unclear_count,
          is_handoff, handoff_reason, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(customer_id) DO UPDATE SET
          state = excluded.state,
          cart_json = excluded.cart_json,
          pending_address_candidates_json = excluded.pending_address_candidates_json,
          address_attempts = excluded.address_attempts,
          confirmed_address_json = excluded.confirmed_address_json,
          shipping_quote_json = excluded.shipping_quote_json,
          consecutive_unclear_count = excluded.consecutive_unclear_count,
          is_handoff = excluded.is_handoff,
          handoff_reason = excluded.handoff_reason,
          updated_at = excluded.updated_at`,
      )
      .run(
        context.customerId,
        context.state,
        JSON.stringify(context.cart),
        JSON.stringify(context.pendingAddressCandidates),
        context.addressAttempts,
        context.confirmedAddress ? JSON.stringify(context.confirmedAddress) : null,
        context.shippingQuote ? JSON.stringify(context.shippingQuote) : null,
        context.consecutiveUnclearCount,
        context.isHandoff ? 1 : 0,
        context.handoffReason ?? null,
        new Date().toISOString(),
      );
  }

  async listHandoff(): Promise<ConversationContext[]> {
    const rows = this.db
      .prepare("SELECT * FROM conversations WHERE is_handoff = 1 ORDER BY updated_at DESC")
      .all() as unknown as ConversationRow[];
    return rows.map(rowToContext);
  }
}
