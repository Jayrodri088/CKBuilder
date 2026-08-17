import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PaymentProofReceipt } from "../payment-proof";
import type { FiberInvoiceSummary } from "../payment-proof";

const execFileAsync = promisify(execFile);

export function paymentPolicy() {
  return {
    enabled: process.env.FIBER_PAYMENT_PROOF_ENABLED !== "false",
    maxCkb: numberEnv("FIBER_PAYMENT_MAX_CKB", 0.05),
    cooldownMs: numberEnv("FIBER_PAYMENT_COOLDOWN_MS", 30_000),
    executionEnabled: process.env.FIBER_PAYMENT_EXECUTION_ENABLED === "true",
    allowedNetwork: process.env.FIBER_PAYMENT_ALLOWED_NETWORK?.trim().toLowerCase() || "testnet",
    invoicePaymentsEnabled: process.env.FIBER_INVOICE_PAYMENTS_ENABLED !== "false",
  };
}

export function paymentTargetConfigured() {
  return /^(?:0x)?[0-9a-fA-F]{66}$/.test(
    process.env.FIBER_PAYMENT_TARGET_PUBKEY?.trim() ?? "",
  );
}

export function validExecutionToken(candidate: string | null) {
  const expected = process.env.FIBER_PAYMENT_EXECUTION_TOKEN?.trim();
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function runFiberPayment(input: {
  amountCkb: number;
  requestId: string;
  execute: boolean;
  invoice?: string;
}): Promise<PaymentProofReceipt> {
  const rpcUrl = process.env.FIBER_RPC_URL?.trim() || "http://127.0.0.1:8227";
  const cliPath = process.env.FNN_CLI_PATH?.trim() || "fnn-cli";
  const target = process.env.FIBER_PAYMENT_TARGET_PUBKEY?.trim();
  if (!input.invoice && !target) throw new Error("A trusted Fiber payment target is not configured.");

  const args = [
    "payment",
    "send_payment",
    "--url",
    rpcUrl,
    ...(input.invoice
      ? ["--invoice", input.invoice]
      : [
          "--target-pubkey",
          target!,
          "--amount",
          String(Math.round(input.amountCkb * 100_000_000)),
          "--keysend",
          "true",
        ]),
    "--dry-run",
    String(!input.execute),
    "--timeout",
    "15",
    "--max-fee-rate",
    "5",
    "--output-format",
    "json",
    "--no-banner",
    "--color",
    "never",
  ];
  let result = await runCli(cliPath, args) as {
    payment_hash?: string;
    status?: string;
    fee?: string;
    failed_error?: string | null;
  };
  if (input.execute && result.payment_hash && !terminalStatus(result.status)) {
    result = await waitForFinalPayment(cliPath, rpcUrl, result.payment_hash, result);
  }
  if (result.failed_error) throw new Error(`Fiber payment failed: ${result.failed_error}`);

  const status = result.status ?? "unknown";
  const settled = input.execute && status.toUpperCase() === "SUCCESS";
  return {
    proofReady: true,
    mode: input.execute ? "executed" : "dry-run",
    settled,
    requestId: input.requestId,
    amountCkb: input.amountCkb,
    asset: "CKB",
    target: input.invoice ? "merchant invoice" : "configured Fiber peer",
    paymentHash: redact(result.payment_hash),
    status,
    fee: result.fee,
    generatedAt: new Date().toISOString(),
    nextAction: input.execute
      ? settled
        ? "Fiber payment settled successfully."
        : "Payment was submitted; verify its final status before treating it as settled."
      : "Route proof succeeded. Live execution remains operator-gated.",
  };
}

export type FiberInvoiceInspect = FiberInvoiceSummary & {
  payeeFull: string;
  paymentHashFull: string;
};

export async function inspectFiberInvoice(encoded: string): Promise<FiberInvoiceInspect> {
  if (!/^[a-z0-9]{100,4096}$/.test(encoded)) {
    throw new Error("Fiber invoice format is invalid.");
  }
  const rpcUrl = process.env.FIBER_RPC_URL?.trim() || "http://127.0.0.1:8227";
  const cliPath = process.env.FNN_CLI_PATH?.trim() || "fnn-cli";
  const parsed = await runCli(cliPath, [
    "invoice",
    "parse_invoice",
    "--url",
    rpcUrl,
    "--invoice",
    encoded,
    "--output-format",
    "json",
    "--no-banner",
    "--color",
    "never",
  ]) as any;
  const invoice = parsed.invoice;
  if (!invoice?.amount || !invoice?.currency || !invoice?.data?.payment_hash) {
    throw new Error("Fiber invoice is missing required signed fields.");
  }
  const attrs = Array.isArray(invoice.data.attrs) ? invoice.data.attrs : [];
  const attribute = (name: string) => attrs.find((item: any) => item && name in item)?.[name];
  const timestamp = integer(invoice.data.timestamp);
  const expirySeconds = integer(attribute("expiry_time") ?? "0xe10");
  const expiresAtMs = timestamp + expirySeconds * 1_000;
  const payee = attribute("payee_public_key");
  if (typeof payee !== "string" || typeof invoice.data.payment_hash !== "string") {
    throw new Error("Fiber invoice is missing signed recipient identity.");
  }
  return {
    amountCkb: integer(invoice.amount) / 100_000_000,
    currency: String(invoice.currency),
    description: attribute("description"),
    payee: redact(payee)!,
    paymentHash: redact(invoice.data.payment_hash)!,
    payeeFull: payee,
    paymentHashFull: invoice.data.payment_hash,
    createdAt: new Date(timestamp).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    expired: Date.now() >= expiresAtMs,
  };
}

export async function parseFiberInvoice(encoded: string): Promise<FiberInvoiceSummary> {
  const inspected = await inspectFiberInvoice(encoded);
  return {
    amountCkb: inspected.amountCkb,
    currency: inspected.currency,
    description: inspected.description,
    payee: inspected.payee,
    paymentHash: inspected.paymentHash,
    createdAt: inspected.createdAt,
    expiresAt: inspected.expiresAt,
    expired: inspected.expired,
  };
}

export type InvoiceWatchStatus = "open" | "paid" | "cancelled" | "expired" | "unknown";

export async function watchFiberInvoice(encoded: string): Promise<{
  status: InvoiceWatchStatus;
  settled: boolean;
  invoice: FiberInvoiceSummary;
}> {
  const inspected = await inspectFiberInvoice(encoded);
  const summary: FiberInvoiceSummary = {
    amountCkb: inspected.amountCkb,
    currency: inspected.currency,
    description: inspected.description,
    payee: inspected.payee,
    paymentHash: inspected.paymentHash,
    createdAt: inspected.createdAt,
    expiresAt: inspected.expiresAt,
    expired: inspected.expired,
  };
  if (inspected.expired) {
    return { status: "expired", settled: false, invoice: summary };
  }
  const rpcUrl = process.env.FIBER_RPC_URL?.trim() || "http://127.0.0.1:8227";
  const cliPath = process.env.FNN_CLI_PATH?.trim() || "fnn-cli";
  try {
    const record = await runCli(cliPath, [
      "invoice",
      "get_invoice",
      "--url",
      rpcUrl,
      "--payment-hash",
      inspected.paymentHashFull,
      "--output-format",
      "json",
      "--no-banner",
      "--color",
      "never",
    ]) as { status?: string; invoice_status?: string };
    const raw = String(record.status ?? record.invoice_status ?? "unknown").toLowerCase();
    const status: InvoiceWatchStatus =
      raw.includes("paid") || raw.includes("received") || raw === "success"
        ? "paid"
        : raw.includes("cancel")
          ? "cancelled"
          : raw.includes("expir")
            ? "expired"
            : raw.includes("open") || raw.includes("unpaid")
              ? "open"
              : "unknown";
    return { status, settled: status === "paid", invoice: summary };
  } catch {
    return { status: inspected.expired ? "expired" : "unknown", settled: false, invoice: summary };
  }
}

export function expectedInvoiceCurrency(network: string) {
  if (network.toLowerCase() === "testnet") return "Fibt";
  if (network.toLowerCase() === "mainnet") return "Fib";
  return undefined;
}

async function runCli(cliPath: string, args: string[]) {
  const { stdout } = await execFileAsync(cliPath, args, {
    timeout: 30_000,
    windowsHide: true,
    env: process.env,
  });
  return JSON.parse(stdout) as Record<string, unknown>;
}

async function waitForFinalPayment(
  cliPath: string,
  rpcUrl: string,
  paymentHash: string,
  initial: Record<string, unknown>,
) {
  let result = initial;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    result = await runCli(cliPath, [
      "payment",
      "get_payment",
      "--url",
      rpcUrl,
      "--payment-hash",
      paymentHash,
      "--output-format",
      "json",
      "--no-banner",
      "--color",
      "never",
    ]);
    if (terminalStatus(typeof result.status === "string" ? result.status : undefined)) return result;
  }
  return result;
}

function terminalStatus(status?: string) {
  const normalized = status?.toUpperCase();
  return normalized === "SUCCESS" || normalized === "FAILED";
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function integer(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") throw new Error("Fiber invoice contains an invalid integer.");
  const parsed = value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Fiber invoice contains an invalid integer.");
  }
  return parsed;
}

function redact(value?: string) {
  if (!value || value.length <= 22) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}
