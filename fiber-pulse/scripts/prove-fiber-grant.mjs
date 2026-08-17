import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.FIBER_GRANT_PROOF_PORT || 3066);
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
const operatorToken = randomBytes(32).toString("hex");
const requestId = `grant-${Date.now()}`;
const amountCkb = 0.01;

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_RPC_URL: "http://127.0.0.1:1",
    FIBER_PAYMENT_TARGET_PUBKEY: `02${"11".repeat(32)}`,
    FIBER_PAYMENT_MAX_CKB: "0.05",
    FIBER_PAYMENT_COOLDOWN_MS: "1",
    FIBER_GRANT_COOLDOWN_MS: "1",
    FIBER_PAYMENT_EXECUTION_ENABLED: "true",
    FIBER_PAYMENT_EXECUTION_TOKEN: operatorToken,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForServer();

  const denied = await fetch(`${origin}/api/fiber/grant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId, amountCkb }),
  });
  assert(denied.status === 403, "grant issue without operator token must return 403");

  const issued = await fetch(`${origin}/api/fiber/grant`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${operatorToken}`,
    },
    body: JSON.stringify({ requestId, amountCkb }),
  });
  const issuedBody = await issued.json();
  assert(issued.ok && issuedBody.issued, "operator token must issue a grant");
  assert(String(issuedBody.grant).startsWith("pls1."), "grant must use pls1 prefix");

  const wrongRequest = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${issuedBody.grant}`,
    },
    body: JSON.stringify({
      amountCkb,
      requestId: `${requestId}-other`,
      execute: true,
    }),
  });
  const wrongRequestBody = await wrongRequest.json();
  assert(wrongRequest.status === 403, "grant bound to another request must return 403");
  assert(String(wrongRequestBody.error).includes("different request"), "binding error must mention request");

  const wrongAmount = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${issuedBody.grant}`,
    },
    body: JSON.stringify({
      amountCkb: 0.02,
      requestId,
      execute: true,
    }),
  });
  assert(wrongAmount.status === 403, "grant amount mismatch must return 403");

  const unreachable = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${issuedBody.grant}`,
    },
    body: JSON.stringify({
      amountCkb,
      requestId,
      execute: true,
    }),
  });
  assert(unreachable.status === 409, "valid grant against an unreachable node must fail closed");

  console.log("PASS grant issue requires the operator token");
  console.log("PASS issued grant is bound to request ID and amount");
  console.log("PASS unused grant does not execute when Fiber is unreachable");
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
