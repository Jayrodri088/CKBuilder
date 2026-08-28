export type PaymentProofReceipt = {
  proofReady: boolean;
  mode: "dry-run" | "executed";
  settled: boolean;
  requestId: string;
  amountCkb: number;
  asset: "CKB";
  target: "configured Fiber peer" | "merchant invoice";
  paymentHash?: string;
  trackingId?: string;
  status: string;
  fee?: string;
  generatedAt: string;
  nextAction: string;
};

export type PaymentStatusReceipt = {
  trackingId: string;
  requestId: string;
  amountCkb: number;
  asset: "CKB";
  paymentHash: string;
  status: string;
  settled: boolean;
  terminal: boolean;
  fee?: string;
  updatedAt: string;
  expiresAt: string;
};

export type PaymentProofPolicy = {
  enabled: boolean;
  maxCkb: number;
  cooldownMs: number;
  executionEnabled: boolean;
  allowedNetwork: string;
  invoicePaymentsEnabled: boolean;
};

export type FiberInvoiceSummary = {
  amountCkb: number;
  currency: string;
  description?: string;
  payee: string;
  paymentHash: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};
