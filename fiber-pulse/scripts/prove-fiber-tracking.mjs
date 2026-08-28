import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.FIBER_TRACKING_PROOF_PORT || 3068);
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
const trackerFile = resolve(".data", `payment-tracker-proof-${process.pid}.json`);
const successId = "a".repeat(32);
const expiredId = "b".repeat(32);
const unknownId = "c".repeat(32);
const fullHash = `0x${"12".repeat(32)}`;
const now = Date.now();

mkdirSync(dirname(trackerFile), { recursive: true });
writeFileSync(trackerFile, JSON.stringify({
  version: 1,
  records: [
    {
      id: successId,
      paymentHash: fullHash,
      requestId: "tracking-proof",
      amountCkb: 0.01,
      status: "Success",
      fee: "0x0",
      createdAt: new Date(now - 1000).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
    },
    {
      id: expiredId,
      paymentHash: `0x${"34".repeat(32)}`,
      requestId: "expired-proof",
      amountCkb: 0.01,
      status: "Created",
      createdAt: new Date(now - 120_000).toISOString(),
      updatedAt: new Date(now - 120_000).toISOString(),
      expiresAt: new Date(now - 60_000).toISOString(),
    },
  ],
}));

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_PAYMENT_TRACKER_FILE: trackerFile,
    FIBER_PAYMENT_TRACKING_COOLDOWN_MS: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForServer();

  const success = await track(successId);
  assert(success.response.ok, "terminal payment tracking must return HTTP 200");
  assert(success.body.settled === true && success.body.terminal === true, "Success must be terminal and settled");
  assert(success.body.requestId === "tracking-proof", "tracking receipt must preserve request binding");
  assert(!JSON.stringify(success.body).includes(fullHash), "public tracking response must redact the full payment hash");

  await sleep(5);
  const invalid = await track("bad-id");
  assert(invalid.response.status === 400, "malformed tracking IDs must return HTTP 400");

  await sleep(5);
  const unknown = await track(unknownId);
  assert(unknown.response.status === 404, "unknown tracking IDs must return HTTP 404");

  await sleep(5);
  const expired = await track(expiredId);
  assert(expired.response.status === 410, "expired tracking IDs must return HTTP 410");

  console.log("PASS terminal payment status survives server restart storage");
  console.log("PASS public status receipt redacts the full payment hash");
  console.log("PASS invalid, unknown, and expired tracking capabilities fail distinctly");
} finally {
  server.kill();
  rmSync(trackerFile, { force: true });
}

async function track(trackingId) {
  const response = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trackingId }),
  });
  return { response, body: await response.json() };
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next server exited early:\n${output}`);
    try {
      await fetch(origin);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for Next server:\n${output}`);
}

function sleep(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
