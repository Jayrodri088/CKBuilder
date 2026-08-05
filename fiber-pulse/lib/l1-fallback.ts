import type { PaymentRequest, PreflightResult } from "./types";

export function generatePreimage(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `pulse-${hex}`;
}

/** Origin of ckb-pay-link (Next default :3000). Override with NEXT_PUBLIC_PAY_LINK_ORIGIN. */
export function payLinkOrigin(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PAY_LINK_ORIGIN) {
    return process.env.NEXT_PUBLIC_PAY_LINK_ORIGIN.replace(/\/$/, "");
  }
  return "http://127.0.0.1:3000";
}

/**
 * Handoff into Pay Link create tab with amount/label/preimage prefilled.
 * Merchant keeps the preimage; Pay Link derives hash-lock address when CKB + script are up.
 */
export function buildL1HandoffUrl(req: PaymentRequest, preimage: string): string {
  const q = new URLSearchParams({
    view: "create",
    from: "pulse",
    amount: String(req.amountCkb),
    label: req.label,
    preimage,
    pulseId: req.id,
  });
  return `${payLinkOrigin()}/?${q.toString()}`;
}

export type FixAction = {
  title: string;
  detail: string;
  action?: "l1" | "lower" | "rebalance" | "live";
};

/** Turn preflight failures into plain-language next steps. */
export function fixesForPreflight(
  req: PaymentRequest,
  pf: PreflightResult | null,
): FixAction[] {
  if (!pf) return [];
  const fixes: FixAction[] = [];

  if (pf.level === "blocked") {
    const joined = pf.reasons.join(" ").toLowerCase();
    if (joined.includes("expired")) {
      fixes.push({
        title: "Request expired",
        detail: "Create a new Pulse payment with a fresh expiry window.",
      });
    }
    if (joined.includes("outbound") || joined.includes("sendable")) {
      fixes.push({
        title: "Not enough Fiber outbound capacity",
        detail: "Lower the amount, rebalance mock channels, or switch to the L1 hash-lock rail.",
        action: "l1",
      });
      fixes.push({
        title: "Lower the amount",
        detail: "Try an amount under the “You can send” total on the capacity strip.",
        action: "lower",
      });
    }
    if (joined.includes("greater than zero")) {
      fixes.push({
        title: "Invalid amount",
        detail: "Set a positive CKB amount before paying.",
      });
    }
    if (fixes.length === 0) {
      fixes.push({
        title: "Fiber rail cannot complete this pay",
        detail: "Use the L1 hash-lock rail via Pay Link, or fix channel liquidity and retry.",
        action: "l1",
      });
    }
  } else if (pf.level === "medium") {
    fixes.push({
      title: "Thin outbound liquidity",
      detail: "Payment can proceed, but it would consume most sendable capacity.",
      action: "rebalance",
    });
    fixes.push({
      title: "Keep L1 as backup",
      detail: "If settle fails, switch to the L1 rail without recreating the request.",
      action: "l1",
    });
  }

  if (pf.source === "mock" && req.mode === "invoice") {
    fixes.push({
      title: "Mock Fiber only until FNN is up",
      detail: "Enable “Probe live Fiber RPC” when a node is on :8227 for a real connectivity check.",
      action: "live",
    });
  }

  return fixes;
}
