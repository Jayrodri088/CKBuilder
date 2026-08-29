import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const invoice = process.env.FIBER_MERCHANT_INVOICE?.trim();
if (!invoice) {
  throw new Error("FIBER_MERCHANT_INVOICE is required");
}

const amountCkb = Number(process.env.FIBER_TWO_NODE_AMOUNT_CKB ?? "0.01");
const port = Number(process.env.FIBER_TWO_NODE_PROOF_PORT ?? "3070");
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
const trackerFile = resolve(".data", `payment-tracker-live-${process.pid}.json`);
const artifactFile = resolve("artifacts", "fiber-two-node-proof.json");
const token = randomBytes(32).toString("hex");
const requestId = `two-node-${Date.now()}`;

if (!Number.isFinite(amountCkb) || amountCkb <= 0 || amountCkb > 0.05) {
  throw new Error("FIBER_TWO_NODE_AMOUNT_CKB must be between 0 and 0.05 CKB");
}

mkdirSync(dirname(trackerFile), { recursive: true });
mkdirSync(dirname(artifactFile), { recursive: true });
rmSync(trackerFile, { force: true });

const serverEnv = {
  ...process.env,
  FIBER_RPC_URL: process.env.FIBER_RPC_URL ?? "http://127.0.0.1:8227",
  FNN_CLI_PATH: process.env.FNN_CLI_PATH ?? "D:\\CKB\\fiber-bin\\fnn-cli.exe",
  FIBER_PAYMENT_PROOF_ENABLED: "true",
  FIBER_PAYMENT_EXECUTION_ENABLED: "true",
  FIBER_PAYMENT_EXECUTION_TOKEN: token,
  FIBER_PAYMENT_ALLOWED_NETWORK: "testnet",
  FIBER_PAYMENT_MAX_CKB: "0.05",
  FIBER_PAYMENT_COOLDOWN_MS: "1",
  FIBER_PAYMENT_TRACKING_COOLDOWN_MS: "1",
  FIBER_PAYMENT_TRACKER_FILE: trackerFile,
};

let server;
let output = "";

try {
  server = startServer();
  await waitForServer(server);

  const paymentResponse = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amountCkb,
      requestId,
      execute: true,
      invoice,
    }),
  });
  const payment = await paymentResponse.json();
  assert(paymentResponse.ok, `live payment returned HTTP ${paymentResponse.status}: ${payment.error ?? "unknown error"}`);
  assert(payment.mode === "executed", "payment receipt must report executed mode");
  assert(payment.settled === true, `payment must settle, received status ${payment.status}`);
  assert(typeof payment.trackingId === "string", "executed payment must return a tracking capability");

  await stopServer(server);
  server = startServer();
  await waitForServer(server);

  const trackingResponse = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trackingId: payment.trackingId }),
  });
  const tracking = await trackingResponse.json();
  assert(trackingResponse.ok, `tracking returned HTTP ${trackingResponse.status}`);
  assert(tracking.settled === true && tracking.terminal === true, "persisted tracking must report terminal settlement");
  assert(tracking.requestId === requestId, "persisted tracking must preserve request binding");

  const artifact = {
    proof: "fiber-two-node-settlement",
    generatedAt: new Date().toISOString(),
    requestId,
    amountCkb,
    payment,
    persistedTracking: tracking,
  };
  writeFileSync(artifactFile, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`PASS settled ${amountCkb} CKB through the Pulse payment API`);
  console.log(`PASS tracking survived an application restart (${payment.trackingId})`);
  console.log(`Evidence: ${artifactFile}`);
} finally {
  if (server) await stopServer(server);
}

function startServer() {
  output = "";
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  return child;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    sleep(5_000),
  ]);
}

async function waitForServer(child) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next server exited early:\n${output}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for Next server:\n${output}`);
}

function sleep(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
