import type { FiberSnapshot } from "./fiber-snapshot";
import { loadMockNode, totalSendCkb } from "./mock-node";
import type { PaymentRequest, PreflightResult } from "./types";

/** Consumer-facing readiness check before pay. Mock and live are explicit modes. */
export async function runPreflight(
  req: PaymentRequest,
  opts?: { tryLive?: boolean },
): Promise<PreflightResult> {
  const started = performance.now();

  if (opts?.tryLive) return runLivePreflight(req, started);

  await sleep(40 + Math.random() * 80);
  const latencyMs = Math.round(performance.now() - started);
  const node = loadMockNode();
  const sendable = totalSendCkb(node);
  const need = req.mode === "stream" ? (req.tickCkb ?? 0.05) : req.amountCkb;

  if (req.amountCkb <= 0) {
    return blocked("Amount must be greater than zero", latencyMs);
  }

  if (Date.now() > req.expiresAt) {
    return blocked("Payment request expired", latencyMs, 5);
  }

  if (need > sendable) {
    return {
      level: "blocked",
      score: 18,
      latencyMs,
      reasons: [
        `Need ${need} CKB outbound; mock channels only hold ${sendable.toFixed(2)} CKB sendable`,
        "Open or rebalance a channel, or lower the amount",
      ],
      canPay: false,
      source: "mock",
    };
  }

  if (req.amountCkb > sendable * 0.7) {
    return {
      level: "medium",
      score: 64,
      latencyMs,
      reasons: [
        "Payment fits, but would consume most outbound liquidity",
        `Sendable now: ${sendable.toFixed(2)} CKB across ready channels`,
      ],
      canPay: true,
      source: "mock",
    };
  }

  return {
    level: "high",
    score: 88 + Math.floor(Math.random() * 8),
    latencyMs,
    reasons: [
      `${node.channels.filter((channel) => channel.state === "ready").length} ready channels`,
      `Outbound capacity ${sendable.toFixed(2)} CKB covers this pay`,
      "Estimated Fiber settle under 60ms (mock)",
    ],
    canPay: true,
    source: "mock",
  };
}

async function runLivePreflight(req: PaymentRequest, started: number): Promise<PreflightResult> {
  try {
    const response = await fetch("/api/fiber", { cache: "no-store" });
    const snapshot = (await response.json()) as FiberSnapshot;
    const latencyMs = Math.round(performance.now() - started);
    const need = req.mode === "stream" ? (req.tickCkb ?? 0.05) : req.amountCkb;
    const readyChannels = snapshot.channels.filter(
      (channel) =>
        channel.state === "ready" && channel.enabled && channel.connected && channel.asset === "CKB",
    );
    const reasons: string[] = [];

    if (!snapshot.reachable) reasons.push("Configured Fiber node is unreachable");
    if (snapshot.node && !snapshot.node.synced) reasons.push("Fiber node is not synced");
    if (snapshot.peerCount === 0) reasons.push("No connected Fiber peers");
    if (readyChannels.length === 0) reasons.push("No connected, enabled CKB channels are ready");
    if (snapshot.maxSendableCkb < need) {
      reasons.push(
        `Need ${need} CKB outbound; ready channels expose ${snapshot.maxSendableCkb.toFixed(2)} CKB`,
      );
    }

    const canPay =
      response.ok &&
      snapshot.reachable &&
      (snapshot.node?.synced ?? false) &&
      snapshot.peerCount > 0 &&
      readyChannels.length > 0 &&
      snapshot.maxSendableCkb >= need;
    if (canPay) {
      reasons.push(
        `${readyChannels.length} ready CKB channel${readyChannels.length === 1 ? "" : "s"}`,
        `${snapshot.maxSendableCkb.toFixed(2)} CKB live outbound capacity covers this payment`,
      );
    }

    return {
      level: canPay ? "high" : "blocked",
      score: canPay ? 94 : 8,
      latencyMs,
      reasons,
      canPay,
      source: "live",
      snapshot,
    };
  } catch (error) {
    return {
      level: "blocked",
      score: 0,
      latencyMs: Math.round(performance.now() - started),
      reasons: [error instanceof Error ? error.message : "Configured Fiber node is unreachable"],
      canPay: false,
      source: "live",
    };
  }
}

function blocked(reason: string, latencyMs: number, score = 0): PreflightResult {
  return {
    level: "blocked",
    score,
    latencyMs,
    reasons: [reason],
    canPay: false,
    source: "mock",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
