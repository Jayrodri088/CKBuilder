import type { PayMode, PaymentRequest } from "./types";

/** Compact shareable payload — payer does not need creator's localStorage. */
export type SharePayload = {
  v: 1 | 2;
  id: string;
  label: string;
  amountCkb: number;
  mode: PayMode;
  streamCapCkb?: number;
  tickCkb?: number;
  createdAt: number;
  expiresAt: number;
  fiberInvoice?: string;
  /** Never include l1Preimage in share links */
};

export function toSharePayload(req: PaymentRequest): SharePayload {
  return {
    v: req.fiberInvoice ? 2 : 1,
    id: req.id,
    label: req.label,
    amountCkb: req.amountCkb,
    mode: req.mode,
    streamCapCkb: req.streamCapCkb,
    tickCkb: req.tickCkb,
    createdAt: req.createdAt,
    expiresAt: req.expiresAt,
    fiberInvoice: req.fiberInvoice,
  };
}

export function payloadToRequest(p: SharePayload, status: PaymentRequest["status"] = "open"): PaymentRequest {
  return {
    id: p.id,
    label: p.label,
    amountCkb: p.amountCkb,
    mode: p.mode,
    rail: "fiber",
    streamCapCkb: p.streamCapCkb,
    tickCkb: p.tickCkb,
    createdAt: p.createdAt,
    expiresAt: p.expiresAt,
    fiberInvoice: p.fiberInvoice,
    status,
    streamedCkb: 0,
  };
}

export function encodePayParam(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const b64 =
    typeof btoa === "function"
      ? btoa(json)
      : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePayParam(raw: string): SharePayload | null {
  try {
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf8");
    const data = JSON.parse(json) as SharePayload;
    if ((data.v !== 1 && data.v !== 2) || !data.id || !(data.amountCkb > 0)) return null;
    if (data.fiberInvoice && !/^[a-z0-9]{100,4096}$/.test(data.fiberInvoice)) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildShareUrl(origin: string, req: PaymentRequest): string {
  return `${origin}/?p=${encodePayParam(toSharePayload(req))}`;
}
