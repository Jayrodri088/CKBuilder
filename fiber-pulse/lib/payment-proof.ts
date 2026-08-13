export type PaymentProofReceipt = {
  proofReady: boolean;
  mode: "dry-run" | "executed";
  settled: boolean;
  requestId: string;
  amountCkb: number;
  asset: "CKB";
  target: "configured Fiber peer" | "merchant invoice";
  paymentHash?: string;
  status: string;
  fee?: string;
  generatedAt: string;
  nextAction: string;
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
