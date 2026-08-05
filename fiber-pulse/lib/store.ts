import type { PaymentRequest } from "./types";

const KEY = "fiber-pulse.requests.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function listRequests(): PaymentRequest[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PaymentRequest[];
  } catch {
    return [];
  }
}

export function saveRequest(req: PaymentRequest): void {
  const all = listRequests().filter((r) => r.id !== req.id);
  all.unshift(req);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 40)));
}

export function getRequest(id: string): PaymentRequest | undefined {
  return listRequests().find((r) => r.id === id);
}

export function updateRequest(
  id: string,
  patch: Partial<PaymentRequest>,
): PaymentRequest | undefined {
  const all = listRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], ...patch };
  localStorage.setItem(KEY, JSON.stringify(all));
  return all[idx];
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
