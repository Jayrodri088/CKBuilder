import type { FiberSnapshot } from "./fiber-snapshot";

export type PayMode = "invoice" | "stream";

export type ConfidenceLevel = "high" | "medium" | "low" | "blocked";

export type PayRail = "fiber" | "l1";

export interface PaymentRequest {
  id: string;
  label: string;
  amountCkb: number;
  mode: PayMode;
  /** Signed Fiber invoice supplied by the merchant for recipient-directed settlement. */
  fiberInvoice?: string;
  /** Preferred settlement rail */
  rail?: PayRail;
  /** Stream: max CKB total for the stream grant */
  streamCapCkb?: number;
  /** Stream: CKB per tick */
  tickCkb?: number;
  createdAt: number;
  expiresAt: number;
  status: "open" | "paid" | "failed" | "expired" | "streaming" | "capped" | "l1_handoff";
  paidAt?: number;
  /** Opaque server capability used to reconcile a submitted live Fiber payment. */
  fiberTrackingId?: string;
  fiberPaymentStatus?: string;
  streamedCkb?: number;
  /** Merchant-only secret for L1 hash-lock handoff */
  l1Preimage?: string;
  l1HandoffUrl?: string;
  /** Derived hash-lock address (when CKB + deployment available) */
  l1LockAddress?: string;
  l1Hash?: string;
  /** Payer-facing Pay Link URL (address + amount + label) */
  l1PayerUrl?: string;
}

export interface PreflightResult {
  level: ConfidenceLevel;
  score: number;
  latencyMs: number;
  reasons: string[];
  canPay: boolean;
  source: "mock" | "live";
  snapshot?: FiberSnapshot;
}
