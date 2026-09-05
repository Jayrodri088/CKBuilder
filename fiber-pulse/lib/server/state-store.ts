import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

type SqlValue = string | number | bigint | null | Uint8Array;
type DatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...parameters: SqlValue[]): Record<string, unknown> | undefined;
    run(...parameters: SqlValue[]): unknown;
  };
  close(): void;
};

type StateOptions = {
  file?: string;
};

const databases = new Map<string, DatabaseSync>();

export function readState<T>(namespace: string, initial: T, options: StateOptions = {}): T {
  const database = configuredDatabase();
  if (database) {
    let row = selectDatabaseState(database, namespace);
    if (!row) {
      const legacy = readFileState(namespace, initial, options);
      database
        .prepare("INSERT OR IGNORE INTO pulse_state(namespace, value, updated_at) VALUES (?, ?, ?)")
        .run(namespace, JSON.stringify(legacy), new Date().toISOString());
      row = selectDatabaseState(database, namespace);
    }
    return parseState(row?.value, initial);
  }
  return readFileState(namespace, initial, options);
}

export function mutateState<T, R>(
  namespace: string,
  initial: T,
  mutate: (state: T) => R,
  options: StateOptions = {},
): R {
  const database = configuredDatabase();
  if (!database) {
    const state = readFileState(namespace, initial, options);
    const result = mutate(state);
    writeFileState(namespace, state, options);
    return result;
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const row = selectDatabaseState(database, namespace);
    const state = row
      ? parseState(row.value, initial)
      : readFileState(namespace, initial, options);
    const result = mutate(state);
    database
      .prepare(`
        INSERT INTO pulse_state(namespace, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(namespace) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `)
      .run(namespace, JSON.stringify(state), new Date().toISOString());
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function stateStoreMode() {
  return process.env.FIBER_STATE_DB_PATH?.trim() ? "sqlite" as const : "file" as const;
}

export function closeStateStores() {
  for (const database of databases.values()) database.close();
  databases.clear();
}

function configuredDatabase() {
  const configured = process.env.FIBER_STATE_DB_PATH?.trim();
  if (!configured) return undefined;
  const path = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  const existing = databases.get(path);
  if (existing) return existing;

  mkdirSync(dirname(path), { recursive: true });
  const getBuiltinModule = (process as NodeJS.Process & {
    getBuiltinModule?: (id: string) => unknown;
  }).getBuiltinModule;
  if (!getBuiltinModule) {
    throw new Error("FIBER_STATE_DB_PATH requires Node.js 22.5 or newer");
  }
  const sqlite = getBuiltinModule("node:sqlite") as {
    DatabaseSync: new (databasePath: string) => DatabaseSync;
  };
  const database = new sqlite.DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS pulse_state (
      namespace TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  databases.set(path, database);
  return database;
}

function selectDatabaseState(database: DatabaseSync, namespace: string) {
  return database
    .prepare("SELECT value FROM pulse_state WHERE namespace = ?")
    .get(namespace) as { value?: unknown } | undefined;
}

function parseState<T>(value: unknown, initial: T): T {
  if (typeof value !== "string") return structuredClone(initial);
  try {
    return JSON.parse(value) as T;
  } catch {
    return structuredClone(initial);
  }
}

function stateFile(namespace: string, options: StateOptions) {
  return options.file ?? join(process.cwd(), ".data", `${namespace}.json`);
}

function readFileState<T>(namespace: string, initial: T, options: StateOptions) {
  try {
    return JSON.parse(readFileSync(stateFile(namespace, options), "utf8")) as T;
  } catch {
    return structuredClone(initial);
  }
}

function writeFileState<T>(namespace: string, state: T, options: StateOptions) {
  const file = stateFile(namespace, options);
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state));
  renameSync(temporary, file);
}
