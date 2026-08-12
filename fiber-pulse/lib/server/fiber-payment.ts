import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PaymentProofReceipt } from "../payment-proof";

const execFileAsync = promisify(execFile);

export function paymentPolicy() {
  return {
    enabled: process.env.FIBER_PAYMENT_PROOF_ENABLED !== "false",
    maxCkb: numberEnv("FIBER_PAYMENT_MAX_CKB", 0.05),
    cooldownMs: numberEnv("FIBER_PAYMENT_COOLDOWN_MS", 30_000),
    executionEnabled: process.env.FIBER_PAYMENT_EXECUTION_ENABLED === "true",
    allowedNetwork: process.env.FIBER_PAYMENT_ALLOWED_NETWORK?.trim().toLowerCase() || "testnet",
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
}): Promise<PaymentProofReceipt> {
  const rpcUrl = process.env.FIBER_RPC_URL?.trim() || "http://127.0.0.1:8227";
  const cliPath = process.env.FNN_CLI_PATH?.trim() || "fnn-cli";
  const target = process.env.FIBER_PAYMENT_TARGET_PUBKEY?.trim();
  if (!target) throw new Error("A trusted Fiber payment target is not configured.");

  const args = [
    "payment",
    "send_payment",
    "--url",
    rpcUrl,
    "--target-pubkey",
    target,
    "--amount",
    String(Math.round(input.amountCkb * 100_000_000)),
    "--keysend",
    "true",
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
    target: "configured Fiber peer",
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

function redact(value?: string) {
  if (!value || value.length <= 22) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}
