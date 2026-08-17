import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFileAsync = promisify(execFile);
const rpcUrl = process.env.FIBER_RPC_URL || "http://127.0.0.1:8227";
const cliPath = process.env.FNN_CLI_PATH || "D:\\CKB\\fiber-bin\\fnn-cli.exe";
const amountCkb = 0.01;
const amountShannons = String(Math.round(amountCkb * 100_000_000));
const port = Number(process.env.FIBER_WATCH_PROOF_PORT || 3067);
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");

let created;
try {
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
    "Fiber Pulse merchant watch proof",
    "--expiry",
    "600",
    "--output-format",
    "json",
    "--no-banner",
    "--color",
    "never",
  ], { timeout: 15_000, windowsHide: true, env: process.env });
  created = JSON.parse(stdout);
} catch (error) {
  console.log("SKIP: FNN unavailable for invoice watch proof -", error.message);
  process.exit(2);
}

const invoice = created.invoice_address || created.invoice;
assert(typeof invoice === "string", "FNN must return an encoded invoice");

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_RPC_URL: rpcUrl,
    FIBER_INVOICE_PAYMENTS_ENABLED: "true",
    FIBER_INVOICE_VALIDATION_COOLDOWN_MS: "1",
    FIBER_INVOICE_WATCH_COOLDOWN_MS: "1",
    FIBER_PAYMENT_COOLDOWN_MS: "1",
    FIBER_PAYMENT_MAX_CKB: "0.05",
    FIBER_PAYMENT_EXECUTION_ENABLED: "true",
    FIBER_PAYMENT_EXECUTION_TOKEN: "watch-proof-token",
    FIBER_INVOICE_CANCEL_COOLDOWN_MS: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

try {
  await waitForServer();
  await sleep(20);

  const watched = await watch(invoice, amountCkb);
  assert(watched.response.ok && watched.body.valid, "unsigned watch must parse a live invoice");
  assert(watched.body.watch === true, "watch flag must be returned");
  assert(watched.body.settled === false, "fresh invoice must not be settled");
  assert(
    watched.body.status === "open" || watched.body.status === "unknown",
    `fresh invoice should be open, received ${watched.body.status}`,
  );

  await sleep(20);
  const last = invoice.at(-1);
  const tampered = `${invoice.slice(0, -1)}${last === "q" ? "p" : "q"}`;
  const bad = await watch(tampered, amountCkb);
  assert(bad.response.status === 400, "tampered invoice watch must return HTTP 400");

  const denied = await fetch(`${origin}/api/fiber/invoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice, amountCkb, cancel: true }),
  });
  assert(denied.status === 403, "cancel without operator token must return 403");

  await sleep(20);
  const cancelled = await fetch(`${origin}/api/fiber/invoice`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer watch-proof-token",
    },
    body: JSON.stringify({ invoice, amountCkb, cancel: true }),
  });
  const cancelledBody = await cancelled.json();
  assert(cancelled.ok && cancelledBody.valid, "operator cancel must succeed on an open invoice");
  assert(cancelledBody.status === "cancelled", `cancel should report cancelled, received ${cancelledBody.status}`);

  console.log("PASS merchant watch reads an unpaid invoice from FNN");
  console.log("PASS watch rejects a tampered invoice");
  console.log("PASS cancel without an operator token is rejected");
  console.log("PASS open invoice cancels and watch reports cancelled");
} finally {
  server.kill();
}

async function watch(encodedInvoice, amount) {
  const response = await fetch(`${origin}/api/fiber/invoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice: encodedInvoice, amountCkb: amount, watch: true }),
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
