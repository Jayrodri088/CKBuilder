import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFileAsync = promisify(execFile);
const rpcUrl = process.env.FIBER_RPC_URL || "http://127.0.0.1:8227";
const cliPath = process.env.FNN_CLI_PATH || "D:\\CKB\\fiber-bin\\fnn-cli.exe";
const amountCkb = 0.01;
const amountShannons = String(Math.round(amountCkb * 100_000_000));
const port = Number(process.env.FIBER_INVOICE_PROOF_PORT || 3065);
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");

const { stdout } = await execFileAsync(cliPath, [
  "invoice",
  "new_invoice",
  "--url",
  rpcUrl,
  "--amount",
  amountShannons,
  "--currency",
  "Fibt",
  "--description",
  "Fiber Pulse invoice policy proof",
  "--expiry",
  "600",
  "--output-format",
  "json",
  "--no-banner",
  "--color",
  "never",
], { timeout: 15_000, windowsHide: true, env: process.env });
const created = JSON.parse(stdout);
const invoice = created.invoice_address || created.invoice;
assert(typeof invoice === "string", "FNN must return an encoded invoice");

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_RPC_URL: rpcUrl,
    FIBER_PAYMENT_TARGET_PUBKEY: "",
    FIBER_INVOICE_PAYMENTS_ENABLED: "true",
    FIBER_INVOICE_VALIDATION_COOLDOWN_MS: "1",
    FIBER_INVOICE_CREATE_COOLDOWN_MS: "1",
    FIBER_PAYMENT_COOLDOWN_MS: "1",
    FIBER_PAYMENT_MAX_CKB: "0.05",
    FIBER_PAYMENT_EXECUTION_ENABLED: "false",
    FIBER_PAYMENT_EXECUTION_TOKEN: "invoice-proof-token",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

try {
  await waitForServer();

  const createResponse = await fetch(`${origin}/api/fiber/invoice`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer invoice-proof-token",
    },
    body: JSON.stringify({
      create: true,
      amountCkb,
      description: "Fiber Pulse API creation proof",
      expirySeconds: 600,
    }),
  });
  const createdByApi = await createResponse.json();
  assert(createResponse.ok && createdByApi.created, "operator must be able to create a signed invoice");
  assert(typeof createdByApi.invoiceAddress === "string", "creation must return an encoded invoice");
  assert(createdByApi.invoice.amountCkb === amountCkb, "created invoice amount must match the request");
  assert(!JSON.stringify(createdByApi).includes(rpcUrl), "creation response must not expose the private RPC URL");

  const valid = await validate(invoice, amountCkb);
  assert(valid.response.ok && valid.body.valid, "signed invoice must validate");
  assert(valid.body.network === "testnet", "invoice must validate against testnet");
  assert(valid.body.invoice.amountCkb === amountCkb, "parsed amount must equal 0.01 CKB");
  assert(valid.body.invoice.currency === "Fibt", "parsed currency must be Fibt");
  assert(valid.body.invoice.expired === false, "new invoice must not be expired");

  await sleep(5);
  const mismatch = await validate(invoice, 0.02);
  assert(mismatch.response.status === 400, "amount mismatch must return HTTP 400");
  assert(mismatch.body.error.includes("amount"), "amount mismatch must be explicit");

  await sleep(5);
  const last = invoice.at(-1);
  const tamperedInvoice = `${invoice.slice(0, -1)}${last === "q" ? "p" : "q"}`;
  const tampered = await validate(tamperedInvoice, amountCkb);
  assert(tampered.response.status === 400, "tampered invoice must return HTTP 400");

  const paymentMismatch = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      amountCkb: 0.02,
      requestId: `invoice-mismatch-${Date.now()}`,
      execute: false,
      invoice,
    }),
  });
  const mismatchPaymentBody = await paymentMismatch.json();
  assert(paymentMismatch.status === 400, "payment endpoint must reject invoice amount mismatch");
  assert(mismatchPaymentBody.error.includes("amount"), "payment mismatch must be explicit");

  console.log("PASS signed Fibt invoice parsed and verified against testnet");
  console.log("PASS operator-gated API creates a signed invoice without exposing private node configuration");
  console.log("PASS invoice amount is bound to the payment request");
  console.log("PASS tampered invoice is rejected");
  console.log("PASS validation and mismatch proofs execute no payment");
} finally {
  server.kill();
}

async function validate(encodedInvoice, amount) {
  const response = await fetch(`${origin}/api/fiber/invoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice: encodedInvoice, amountCkb: amount }),
  });
  return { response, body: await response.json() };
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next server exited early:\n${serverOutput}`);
    try {
      await fetch(origin);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for Next server:\n${serverOutput}`);
}

function sleep(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
