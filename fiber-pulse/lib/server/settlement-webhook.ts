import { createHash, createHmac, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { FiberInvoiceSummary } from "../payment-proof";
import { mutateState, readState } from "./state-store.ts";

type SettlementPayload = {
  version: 1;
  event: "fiber.invoice.settled";
  eventId: string;
  invoiceId: string;
  amountCkb: number;
  currency: string;
  description?: string;
  status: "paid";
  observedAt: string;
};

type DeliveryRecord = {
  eventId: string;
  payload: SettlementPayload;
  state: "pending" | "delivering" | "delivered" | "failed";
  attempts: number;
  leaseId?: string;
  leaseUntil?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  lastError?: string;
};

type OutboxStore = {
  version: 1;
  records: DeliveryRecord[];
};

type WebhookConfig = {
  url: string;
  secret: string;
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
};

export type SettlementWebhookResult = {
  configured: boolean;
  eventId?: string;
  state: "disabled" | "misconfigured" | "pending" | "delivered" | "failed";
  attempts?: number;
  nextAttemptAt?: string;
};

export type SettlementDrainResult = {
  configured: boolean;
  examined: number;
  delivered: number;
  pending: number;
  failed: number;
};

const maxRecords = 500;

export async function notifyFiberSettlement(input: {
  encodedInvoice: string;
  invoice: FiberInvoiceSummary;
}): Promise<SettlementWebhookResult> {
  const config = webhookConfig();
  if (config.state !== "configured") return config.result;

  const invoiceId = createHash("sha256").update(input.encodedInvoice).digest("hex");
  const eventId = `fps_${invoiceId.slice(0, 32)}`;
  const existing = mutateState("settlement-webhooks", emptyStore(), (store) => {
    let record = store.records.find((item) => item.eventId === eventId);
    if (!record) {
      record = {
        eventId,
        payload: {
          version: 1,
          event: "fiber.invoice.settled",
          eventId,
          invoiceId,
          amountCkb: input.invoice.amountCkb,
          currency: input.invoice.currency,
          description: input.invoice.description,
          status: "paid",
          observedAt: new Date().toISOString(),
        },
        state: "pending",
        attempts: 0,
      };
      store.records.unshift(record);
      store.records = store.records.slice(0, maxRecords);
    }
    return structuredClone(record);
  }, outboxOptions());

  if (existing.state === "delivered" || existing.state === "failed") {
    return publicResult(existing);
  }
  return deliverEvent(eventId, config);
}

export async function drainPendingFiberSettlements(limit = 20): Promise<SettlementDrainResult> {
  const config = webhookConfig();
  if (config.state !== "configured") {
    return { configured: false, examined: 0, delivered: 0, pending: 0, failed: 0 };
  }
  const now = Date.now();
  const eventIds = readState("settlement-webhooks", emptyStore(), outboxOptions()).records
    .filter((record) => eligibleForDelivery(record, now))
    .slice(0, Math.max(1, Math.min(100, Math.floor(limit))))
    .map((record) => record.eventId);
  const result: SettlementDrainResult = {
    configured: true,
    examined: eventIds.length,
    delivered: 0,
    pending: 0,
    failed: 0,
  };
  for (const eventId of eventIds) {
    const delivery = await deliverEvent(eventId, config);
    if (delivery.state === "delivered") result.delivered += 1;
    else if (delivery.state === "failed") result.failed += 1;
    else result.pending += 1;
  }
  return result;
}

async function deliverEvent(eventId: string, config: WebhookConfig): Promise<SettlementWebhookResult> {
  const claim = claimDelivery(eventId, config);
  if (!claim.claimed) return claim.result;

  const { record } = claim;
  const body = JSON.stringify(record.payload);
  const timestamp = record.payload.observedAt;
  const signature = createHmac("sha256", config.secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  let delivered = false;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": eventId,
        "x-fiber-pulse-event": record.payload.event,
        "x-fiber-pulse-timestamp": timestamp,
        "x-fiber-pulse-signature": `sha256=${signature}`,
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    delivered = true;
  } catch (error) {
    errorMessage = safeError(error);
  }

  return completeDelivery(record, config, delivered, errorMessage);
}

function claimDelivery(eventId: string, config: WebhookConfig):
  | { claimed: true; record: DeliveryRecord }
  | { claimed: false; result: SettlementWebhookResult } {
  return mutateState("settlement-webhooks", emptyStore(), (store) => {
    const record = store.records.find((item) => item.eventId === eventId);
    if (!record) {
      return { claimed: false as const, result: { configured: true, state: "failed" as const } };
    }
    if (!eligibleForDelivery(record, Date.now())) {
      return { claimed: false as const, result: publicResult(record) };
    }
    record.state = "delivering";
    record.attempts += 1;
    record.leaseId = randomUUID();
    record.leaseUntil = new Date(Date.now() + config.timeoutMs + 5_000).toISOString();
    return { claimed: true as const, record: structuredClone(record) };
  }, outboxOptions());
}

function completeDelivery(
  claimed: DeliveryRecord,
  config: WebhookConfig,
  delivered: boolean,
  errorMessage?: string,
) {
  return mutateState("settlement-webhooks", emptyStore(), (store) => {
    const record = store.records.find((item) => item.eventId === claimed.eventId);
    if (!record || record.leaseId !== claimed.leaseId) {
      return record ? publicResult(record) : { configured: true, state: "failed" as const };
    }
    record.leaseId = undefined;
    record.leaseUntil = undefined;
    if (delivered) {
      record.state = "delivered";
      record.deliveredAt = new Date().toISOString();
      record.nextAttemptAt = undefined;
      record.lastError = undefined;
    } else {
      record.lastError = errorMessage ?? "delivery failed";
      if (record.attempts >= config.maxAttempts) {
        record.state = "failed";
        record.nextAttemptAt = undefined;
      } else {
        record.state = "pending";
        const delay = Math.min(
          config.retryBaseMs * 2 ** Math.max(0, record.attempts - 1),
          60 * 60 * 1000,
        );
        record.nextAttemptAt = new Date(Date.now() + delay).toISOString();
      }
    }
    return publicResult(record);
  }, outboxOptions());
}

function eligibleForDelivery(record: DeliveryRecord, now: number) {
  if (record.state === "delivered" || record.state === "failed") return false;
  if (record.state === "delivering") {
    return !record.leaseUntil || Date.parse(record.leaseUntil) <= now;
  }
  return !record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= now;
}

function webhookConfig():
  | ({ state: "configured" } & WebhookConfig)
  | { state: "unavailable"; result: SettlementWebhookResult } {
  const rawUrl = process.env.FIBER_SETTLEMENT_WEBHOOK_URL?.trim();
  const secret = process.env.FIBER_SETTLEMENT_WEBHOOK_SECRET?.trim();
  if (!rawUrl && !secret) {
    return { state: "unavailable", result: { configured: false, state: "disabled" } };
  }
  if (!rawUrl || !secret || secret.length < 32) {
    return { state: "unavailable", result: { configured: false, state: "misconfigured" } };
  }

  try {
    const url = new URL(rawUrl);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
    const allowLoopback = process.env.FIBER_SETTLEMENT_WEBHOOK_ALLOW_HTTP_LOOPBACK === "true";
    if (url.username || url.password || url.hash) throw new Error("URL credentials and fragments are forbidden");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && allowLoopback)) {
      throw new Error("Webhook URL must use HTTPS");
    }
    return {
      state: "configured",
      url: url.toString(),
      secret,
      timeoutMs: boundedNumberEnv("FIBER_SETTLEMENT_WEBHOOK_TIMEOUT_MS", 5_000, 500, 10_000),
      maxAttempts: boundedNumberEnv("FIBER_SETTLEMENT_WEBHOOK_MAX_ATTEMPTS", 8, 1, 20),
      retryBaseMs: boundedNumberEnv("FIBER_SETTLEMENT_WEBHOOK_RETRY_BASE_MS", 5_000, 1, 60 * 60 * 1000),
    };
  } catch {
    return { state: "unavailable", result: { configured: false, state: "misconfigured" } };
  }
}

function publicResult(record: DeliveryRecord): SettlementWebhookResult {
  return {
    configured: true,
    eventId: record.eventId,
    state: record.state === "delivering" ? "pending" : record.state,
    attempts: record.attempts,
    nextAttemptAt: record.nextAttemptAt,
  };
}

function outboxOptions() {
  return {
    file: process.env.FIBER_SETTLEMENT_WEBHOOK_STORE_FILE?.trim()
      || join(process.cwd(), ".data", "settlement-webhooks.json"),
  };
}

function emptyStore(): OutboxStore {
  return { version: 1, records: [] };
}

function boundedNumberEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? Math.floor(value)
    : fallback;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "delivery failed";
  return message.replace(/[\r\n]/g, " ").slice(0, 160);
}
