import { spawn } from "node:child_process";
import { resolve } from "node:path";

const port = 3061;
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_RPC_URL: "http://127.0.0.1:1",
    FIBER_PAYMENT_TARGET_PUBKEY: `02${"11".repeat(32)}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForServer();

  const snapshotResponse = await fetch(`${origin}/api/fiber`, { cache: "no-store" });
  const snapshot = await snapshotResponse.json();
  assert(snapshotResponse.status === 502, "unreachable configured node should return 502");
  assert(snapshot.reachable === false, "snapshot must report reachable=false");
  assert(Array.isArray(snapshot.channels), "snapshot must expose normalized channels");
  assert(!JSON.stringify(snapshot).includes("127.0.0.1:1"), "private RPC URL must not leak");

  const blockedProxy = await fetch(`${origin}/api/fiber`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "send_payment", params: [{ amount: "5000000" }] }),
  });
  assert(blockedProxy.status === 403, "arbitrary Fiber RPC method must be rejected");

  const policyResponse = await fetch(`${origin}/api/fiber/payment`);
  const policy = await policyResponse.json();
  assert(policyResponse.ok && policy.maxCkb === 0.05, "bounded payment policy must be public");

  const oversized = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amountCkb: 1, requestId: "security-proof", execute: false }),
  });
  assert(oversized.status === 400, "oversized payment proof must be rejected before node access");

  const grantDenied = await fetch(`${origin}/api/fiber/grant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amountCkb: 0.01, requestId: "security-proof" }),
  });
  assert(grantDenied.status === 403, "grant issue without operator token must return 403");

  const cancelDenied = await fetch(`${origin}/api/fiber/invoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice: "fibt" + "a".repeat(120), amountCkb: 0.01, cancel: true }),
  });
  assert(cancelDenied.status === 403, "invoice cancel without operator token must return 403");

  console.log("PASS public Fiber snapshot is normalized and redacted");
  console.log("PASS arbitrary send_payment forwarding is blocked with HTTP 403");
  console.log("PASS payment proof policy exposes a 0.05 CKB cap");
  console.log("PASS oversized payment proof fails before execution");
  console.log("PASS payment grant issue is operator-gated");
  console.log("PASS invoice cancel is operator-gated");
} finally {
  server.kill();
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next server exited early:\n${output}`);
    try {
      await fetch(origin);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error(`Timed out waiting for Next server:\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
