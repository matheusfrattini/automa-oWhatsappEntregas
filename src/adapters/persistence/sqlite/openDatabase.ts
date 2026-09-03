import { DatabaseSync } from "./sqliteModule.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./migrate.js";

/**
 * Usa o módulo nativo node:sqlite (estável a partir do Node 22+, sem
 * dependência externa nem compilação nativa). dbPath=":memory:" para testes.
 */
export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  return db;
}
