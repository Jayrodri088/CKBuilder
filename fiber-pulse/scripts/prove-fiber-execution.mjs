import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const rpcUrl = process.env.FIBER_RPC_URL || "http://127.0.0.1:8227";
const amountCkb = Number(process.env.FIBER_EXECUTION_AMOUNT_CKB || 0.01);
const amountShannons = BigInt(Math.round(amountCkb * 100_000_000));
const port = Number(process.env.FIBER_EXECUTION_PORT || 3064);
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");

if (!Number.isFinite(amountCkb) || amountCkb <= 0 || amountCkb > 0.01) {
  throw new Error("FIBER_EXECUTION_AMOUNT_CKB must be between 0 and 0.01 CKB");
}

const beforeChannel = await readyCkbChannel();
const operatorToken = randomBytes(32).toString("hex");
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_RPC_URL: rpcUrl,
    FIBER_PAYMENT_PROOF_ENABLED: "true",
    FIBER_PAYMENT_TARGET_PUBKEY: beforeChannel.pubkey,
    FIBER_PAYMENT_MAX_CKB: "0.01",
    FIBER_PAYMENT_COOLDOWN_MS: "1",
    FIBER_PAYMENT_ALLOWED_NETWORK: "testnet",
    FIBER_PAYMENT_EXECUTION_ENABLED: "true",
    FIBER_PAYMENT_EXECUTION_TOKEN: operatorToken,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

try {
  await waitForServer();
  const snapshotResponse = await fetch(`${origin}/api/fiber`, { cache: "no-store" });
  const snapshot = await snapshotResponse.json();
  assert(snapshotResponse.ok && snapshot.reachable, "Fiber snapshot must be reachable");
  assert(snapshot.node?.network === "testnet", "live execution refuses non-testnet nodes");
  assert(snapshot.maxSendableCkb >= amountCkb, "ready channel must cover execution amount");

  const executionResponse = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${operatorToken}`,
    },
    body: JSON.stringify({
      amountCkb,
      requestId: `live-execution-${Date.now()}`,
      execute: true,
    }),
  });
  const receipt = await executionResponse.json();
  assert(executionResponse.ok, receipt.error || `execution returned HTTP ${executionResponse.status}`);
  assert(receipt.mode === "executed", "receipt mode must be executed");
  assert(receipt.settled === true, `payment must settle successfully, received ${receipt.status}`);
  assert(String(receipt.status).toUpperCase() === "SUCCESS", "final payment status must be Success");

  const afterChannel = await waitForBalanceDelta(beforeChannel.channel_id);
  const beforeLocal = shannons(beforeChannel.local_balance);
  const beforeRemote = shannons(beforeChannel.remote_balance);
  const afterLocal = shannons(afterChannel.local_balance);
  const afterRemote = shannons(afterChannel.remote_balance);
  const localDecrease = beforeLocal - afterLocal;
  const remoteIncrease = afterRemote - beforeRemote;
  assert(localDecrease >= amountShannons, "local channel balance must decrease by payment amount");
  assert(remoteIncrease >= amountShannons, "remote channel balance must increase by payment amount");

  const evidence = {
    generatedAt: new Date().toISOString(),
    network: snapshot.node.network,
    amountCkb,
    channel: short(beforeChannel.channel_id),
    before: { localCkb: ckb(beforeLocal), remoteCkb: ckb(beforeRemote) },
    after: { localCkb: ckb(afterLocal), remoteCkb: ckb(afterRemote) },
    delta: { localDecreaseCkb: ckb(localDecrease), remoteIncreaseCkb: ckb(remoteIncrease) },
    receipt,
  };
  const artifacts = resolve("artifacts");
  await mkdir(artifacts, { recursive: true });
  const outputPath = resolve(artifacts, "fiber-live-execution.json");
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(`PASS ${amountCkb} CKB live Fiber payment settled with status ${receipt.status}`);
  console.log(`PASS local balance ${evidence.before.localCkb} -> ${evidence.after.localCkb} CKB`);
  console.log(`PASS remote balance ${evidence.before.remoteCkb} -> ${evidence.after.remoteCkb} CKB`);
  console.log(`Evidence: ${outputPath}`);
} finally {
  server.kill();
}

async function readyCkbChannel() {
  const result = await rpc("list_channels", [{}]);
  const channels = Array.isArray(result) ? result : result.channels ?? [];
  const channel = channels.find((candidate) => {
    const state = String(candidate.state?.state_name ?? candidate.state_name ?? candidate.state).toUpperCase();
    return (state === "CHANNELREADY" || state === "OPEN") && !candidate.funding_udt_type_script;
  });
  if (!channel?.channel_id || !channel.pubkey) throw new Error("No ready CKB channel was found");
  return channel;
}

async function waitForBalanceDelta(channelId) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const channel = await readyCkbChannel();
    if (channel.channel_id === channelId && shannons(channel.local_balance) < shannons(beforeChannel.local_balance)) {
      return channel;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("Payment succeeded but channel balance delta was not observed within 15 seconds");
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Fiber RPC returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${body.error.code}: ${body.error.message}`);
  return body.result;
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next server exited early:\n${serverOutput}`);
    try {
      await fetch(origin);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error(`Timed out waiting for Next server:\n${serverOutput}`);
}

function shannons(value) {
  return BigInt(value || "0x0");
}

function ckb(value) {
  return Number(value) / 100_000_000;
}

function short(value) {
  return value.length > 22 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
