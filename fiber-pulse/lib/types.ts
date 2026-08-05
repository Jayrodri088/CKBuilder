export type PayMode = "invoice" | "stream";

export type ConfidenceLevel = "high" | "medium" | "low" | "blocked";

export type PayRail = "fiber" | "l1";

export interface PaymentRequest {
  id: string;
  label: string;
  amountCkb: number;
  mode: PayMode;
  /** Preferred settlement rail */
  rail?: PayRail;
  /** Stream: max CKB total for the stream grant */
  streamCapCkb?: number;
  /** Stream: CKB per tick */
  tickCkb?: number;
  createdAt: number;
  expiresAt: number;
  status: "open" | "paid" | "expired" | "streaming" | "capped" | "l1_handoff";
  paidAt?: number;
  streamedCkb?: number;
  /** Merchant-only secret for L1 hash-lock handoff */
  l1Preimage?: string;
  l1HandoffUrl?: string;
}

export interface PreflightResult {
  level: ConfidenceLevel;
  score: number;
  latencyMs: number;
  reasons: string[];
  canPay: boolean;
  source: "mock" | "live";
}
