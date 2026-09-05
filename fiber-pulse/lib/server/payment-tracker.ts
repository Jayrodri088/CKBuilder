import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { mutateState, readState } from "./state-store.ts";

export type TrackedPayment = {
  id: string;
  paymentHash: string;
  requestId: string;
  amountCkb: number;
  status: string;
  fee?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type TrackerStore = {
  version: 1;
  records: TrackedPayment[];
};

const defaultTtlMs = 24 * 60 * 60 * 1000;
const maxRecords = 500;

export function registerTrackedPayment(input: {
  paymentHash: string;
  requestId: string;
  amountCkb: number;
  status: string;
  fee?: string;
}) {
  const now = new Date();
  const ttlMs = positiveNumberEnv("FIBER_PAYMENT_TRACKING_TTL_MS", defaultTtlMs);
  const record: TrackedPayment = {
    id: randomBytes(16).toString("hex"),
    paymentHash: input.paymentHash,
    requestId: input.requestId,
    amountCkb: input.amountCkb,
    status: input.status,
    fee: input.fee,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
  mutateState("payment-tracker", emptyStore(), (store) => {
    store.records.unshift(record);
    store.records = store.records
      .filter((item) => Date.parse(item.expiresAt) > now.getTime())
      .slice(0, maxRecords);
  }, trackerOptions());
  return record;
}

export function findTrackedPayment(id: string) {
  if (!/^[0-9a-f]{32}$/.test(id)) return { state: "invalid" as const };
  const record = readState("payment-tracker", emptyStore(), trackerOptions())
    .records.find((item) => item.id === id);
  if (!record) return { state: "not_found" as const };
  if (Date.parse(record.expiresAt) <= Date.now()) return { state: "expired" as const };
  return { state: "found" as const, record };
}

export function updateTrackedPayment(id: string, patch: Pick<TrackedPayment, "status"> & { fee?: string }) {
  return mutateState("payment-tracker", emptyStore(), (store) => {
    const record = store.records.find((item) => item.id === id);
    if (!record) return undefined;
    record.status = patch.status;
    record.fee = patch.fee ?? record.fee;
    record.updatedAt = new Date().toISOString();
    return record;
  }, trackerOptions());
}

function trackerFile() {
  return process.env.FIBER_PAYMENT_TRACKER_FILE?.trim() || join(process.cwd(), ".data", "payment-tracker.json");
}

function trackerOptions() {
  return { file: trackerFile() };
}

function emptyStore(): TrackerStore {
  return { version: 1, records: [] };
}

function positiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
