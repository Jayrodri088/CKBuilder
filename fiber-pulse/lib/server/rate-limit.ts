import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), ".data", "rate-limit.json");

type Store = Record<string, number>;

function load(): Store {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Store;
  } catch {
    return {};
  }
}

function save(store: Store) {
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, file);
}

export function claimCooldown(
  key: string,
  cooldownMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const store = load();
  const last = store[key] ?? 0;
  const wait = cooldownMs - (now - last);
  if (wait > 0) return { ok: false, retryAfterMs: wait };
  store[key] = now;
  save(store);
  return { ok: true };
}
