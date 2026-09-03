/**
 * node:sqlite ainda não está na lista de builtins que o Vite/Vitest reconhece
 * para externalizar automaticamente (é recente — estável a partir do Node 22+).
 * process.getBuiltinModule evita que o bundler tente resolver "node:sqlite"
 * como um pacote de verdade.
 */
type SqliteModule = typeof import("node:sqlite");

const sqliteModule = process.getBuiltinModule("node:sqlite") as SqliteModule;

export const DatabaseSync = sqliteModule.DatabaseSync;
export type DatabaseSync = InstanceType<typeof DatabaseSync>;
