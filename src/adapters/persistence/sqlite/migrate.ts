import type { DatabaseSync } from "./sqliteModule.js";

interface Migration {
  id: string;
  up: (db: DatabaseSync) => void;
}

const migrations: Migration[] = [
  {
    id: "0001_create_orders",
    up: (db) => {
      db.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          items_json TEXT NOT NULL,
          subtotal_cents INTEGER NOT NULL,
          shipping_cents INTEGER NOT NULL,
          total_cents INTEGER NOT NULL,
          address_label TEXT NOT NULL,
          address_lat REAL NOT NULL,
          address_lon REAL NOT NULL,
          distance_meters REAL NOT NULL,
          window_date TEXT NOT NULL,
          window_slot TEXT NOT NULL,
          confirmed_at TEXT NOT NULL
        );
        CREATE INDEX idx_orders_window ON orders(window_date, window_slot);
      `);
    },
  },
  {
    id: "0002_create_conversations",
    up: (db) => {
      db.exec(`
        CREATE TABLE conversations (
          customer_id TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          cart_json TEXT NOT NULL,
          pending_address_candidates_json TEXT NOT NULL,
          address_attempts INTEGER NOT NULL,
          confirmed_address_json TEXT,
          shipping_quote_json TEXT,
          consecutive_unclear_count INTEGER NOT NULL,
          is_handoff INTEGER NOT NULL,
          handoff_reason TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_conversations_handoff ON conversations(is_handoff);
      `);
    },
  },
];

/**
 * Runner de migration simples: tabela de controle + lista ordenada de passos
 * idempotentes. Sem framework — não precisamos de mais que isso nesta fase.
 */
export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: string }).id),
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}
