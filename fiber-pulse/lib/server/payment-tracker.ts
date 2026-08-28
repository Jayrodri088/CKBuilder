import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
  const store = load();
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
  store.records.unshift(record);
  store.records = store.records.filter((item) => Date.parse(item.expiresAt) > now.getTime()).slice(0, maxRecords);
  save(store);
  return record;
}

export function findTrackedPayment(id: string) {
  if (!/^[0-9a-f]{32}$/.test(id)) return { state: "invalid" as const };
  const record = load().records.find((item) => item.id === id);
  if (!record) return { state: "not_found" as const };
  if (Date.parse(record.expiresAt) <= Date.now()) return { state: "expired" as const };
  return { state: "found" as const, record };
}

export function updateTrackedPayment(id: string, patch: Pick<TrackedPayment, "status"> & { fee?: string }) {
  const store = load();
  const record = store.records.find((item) => item.id === id);
  if (!record) return undefined;
  record.status = patch.status;
  record.fee = patch.fee ?? record.fee;
  record.updatedAt = new Date().toISOString();
  save(store);
  return record;
}

function trackerFile() {
  return process.env.FIBER_PAYMENT_TRACKER_FILE?.trim() || join(process.cwd(), ".data", "payment-tracker.json");
}

function load(): TrackerStore {
  try {
    const value = JSON.parse(readFileSync(trackerFile(), "utf8")) as TrackerStore;
    return value.version === 1 && Array.isArray(value.records) ? value : { version: 1, records: [] };
  } catch {
    return { version: 1, records: [] };
  }
}

function save(store: TrackerStore) {
  const file = trackerFile();
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, file);
}

function positiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
