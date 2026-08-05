import type { PaymentRequest, PreflightResult } from "./types";
import { loadMockNode, totalSendCkb } from "./mock-node";

/**
 * Consumer-facing readiness check before pay.
 * Mock by default; optional live Fiber RPC via /api/fiber.
 */
export async function runPreflight(
  req: PaymentRequest,
  opts?: { tryLive?: boolean },
): Promise<PreflightResult> {
  const started = performance.now();

  if (opts?.tryLive) {
    try {
      const res = await fetch("/api/fiber", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "node_info", params: [] }),
      });
      if (res.ok) {
        const body = await res.json();
        if (!body.error) {
          const latencyMs = Math.round(performance.now() - started);
          return {
            level: "high",
            score: 92,
            latencyMs,
            reasons: [
              "Live Fiber node reachable",
              `Amount ${req.amountCkb} CKB — confirm outbound capacity on node`,
              "Pathfinding not fully wired yet; treat as connectivity pass",
            ],
            canPay: true,
            source: "live",
          };
        }
      }
    } catch {
      /* fall through to mock */
    }
  }

  await sleep(40 + Math.random() * 80);
  const latencyMs = Math.round(performance.now() - started);
  const node = loadMockNode();
  const sendable = totalSendCkb(node);
  const need =
    req.mode === "stream" ? (req.tickCkb ?? 0.05) : req.amountCkb;

  if (req.amountCkb <= 0) {
    return {
      level: "blocked",
      score: 0,
      latencyMs,
      reasons: ["Amount must be greater than zero"],
      canPay: false,
      source: "mock",
    };
  }

  if (Date.now() > req.expiresAt) {
    return {
      level: "blocked",
      score: 5,
      latencyMs,
      reasons: ["Payment request expired"],
      canPay: false,
      source: "mock",
    };
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
      `${node.channels.filter((c) => c.state === "ready").length} ready channels`,
      `Outbound capacity ${sendable.toFixed(2)} CKB covers this pay`,
      "Estimated Fiber settle under 60ms (mock)",
    ],
    canPay: true,
    source: "mock",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
