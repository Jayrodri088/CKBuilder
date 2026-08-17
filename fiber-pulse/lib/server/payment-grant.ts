import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), ".data", "payment-grants.json");

type GrantRecord = {
  requestId: string;
  amountCkb: number;
  invoiceFp: string;
  exp: number;
  usedAt?: number;
};

type Store = Record<string, GrantRecord>;

type GrantPayload = {
  v: 1;
  id: string;
  requestId: string;
  amountCkb: number;
  invoiceFp: string;
  exp: number;
};

function grantSecret() {
  const dedicated = process.env.FIBER_PAYMENT_GRANT_SECRET?.trim();
  if (dedicated) return dedicated;
  const operator = process.env.FIBER_PAYMENT_EXECUTION_TOKEN?.trim();
  if (operator) return createHash("sha256").update(`pulse-grant-v1:${operator}`).digest("hex");
  return undefined;
}

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

export function invoiceFingerprint(invoice?: string) {
  return createHash("sha256")
    .update(invoice?.trim() || "")
    .digest("hex")
    .slice(0, 24);
}

function sign(payload: GrantPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `pls1.${body}.${mac}`;
}

function parseToken(token: string, secret: string): GrantPayload | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pls1") return undefined;
  const expected = createHmac("sha256", secret).update(parts[1]).digest("base64url");
  const left = Buffer.from(parts[2]);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as GrantPayload;
    if (payload.v !== 1 || !payload.id || !payload.requestId) return undefined;
    return payload;
  } catch {
    return undefined;
  }
}

export function issuePaymentGrant(input: {
  requestId: string;
  amountCkb: number;
  invoice?: string;
  ttlMs?: number;
}) {
  const secret = grantSecret();
  if (!secret) throw new Error("Payment grant secret is not configured.");
  const id = randomBytes(12).toString("hex");
  const payload: GrantPayload = {
    v: 1,
    id,
    requestId: input.requestId,
    amountCkb: input.amountCkb,
    invoiceFp: invoiceFingerprint(input.invoice),
    exp: Date.now() + (input.ttlMs ?? 10 * 60_000),
  };
  const store = load();
  store[id] = {
    requestId: payload.requestId,
    amountCkb: payload.amountCkb,
    invoiceFp: payload.invoiceFp,
    exp: payload.exp,
  };
  save(store);
  return {
    grant: sign(payload, secret),
    grantId: id,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function assertPaymentGrant(input: {
  token: string;
  requestId: string;
  amountCkb: number;
  invoice?: string;
}) {
  return inspectGrant(input, false);
}

export function consumePaymentGrant(input: {
  token: string;
  requestId: string;
  amountCkb: number;
  invoice?: string;
}) {
  return inspectGrant(input, true);
}

function inspectGrant(
  input: {
    token: string;
    requestId: string;
    amountCkb: number;
    invoice?: string;
  },
  consume: boolean,
) {
  const secret = grantSecret();
  if (!secret) return { ok: false as const, error: "Payment grants are not configured." };
  const payload = parseToken(input.token, secret);
  if (!payload) return { ok: false as const, error: "Payment grant is invalid." };
  if (Date.now() >= payload.exp) return { ok: false as const, error: "Payment grant has expired." };
  if (payload.requestId !== input.requestId) {
    return { ok: false as const, error: "Payment grant is bound to a different request." };
  }
  if (Math.round(payload.amountCkb * 100_000_000) !== Math.round(input.amountCkb * 100_000_000)) {
    return { ok: false as const, error: "Payment grant amount does not match." };
  }
  if (payload.invoiceFp !== invoiceFingerprint(input.invoice)) {
    return { ok: false as const, error: "Payment grant is bound to a different invoice." };
  }
  const store = load();
  const record = store[payload.id];
  if (!record) return { ok: false as const, error: "Payment grant is unknown." };
  if (record.usedAt) return { ok: false as const, error: "Payment grant has already been used." };
  if (consume) {
    record.usedAt = Date.now();
    store[payload.id] = record;
    save(store);
  }
  return { ok: true as const, grantId: payload.id };
}

export function looksLikePaymentGrant(token: string | null) {
  return Boolean(token?.startsWith("pls1."));
}
