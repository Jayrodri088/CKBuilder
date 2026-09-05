import { mutateState } from "./state-store.ts";

type Store = Record<string, number>;

export function claimCooldown(
  key: string,
  cooldownMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  return mutateState<Store, { ok: true } | { ok: false; retryAfterMs: number }>(
    "rate-limit",
    {},
    (store) => {
      const last = store[key] ?? 0;
      const wait = cooldownMs - (now - last);
      if (wait > 0) return { ok: false, retryAfterMs: wait };
      store[key] = now;
      return { ok: true };
    },
  );
}
