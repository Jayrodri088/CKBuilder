import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const rpcUrl = process.env.FIBER_RPC_URL || "http://127.0.0.1:8227";
const amountCkb = Number(process.env.FIBER_PROOF_AMOUNT_CKB || 0.01);
const port = Number(process.env.FIBER_PROOF_PORT || 3063);
const origin = `http://127.0.0.1:${port}`;
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");

if (!Number.isFinite(amountCkb) || amountCkb <= 0 || amountCkb > 0.05) {
  throw new Error("FIBER_PROOF_AMOUNT_CKB must be between 0 and 0.05 CKB");
}

const channelsResult = await rpc("list_channels", [{}]);
const channels = Array.isArray(channelsResult) ? channelsResult : channelsResult.channels ?? [];
const readyChannel = channels.find((channel) => {
  const state = String(channel.state?.state_name ?? channel.state_name ?? channel.state).toUpperCase();
  return (state === "CHANNELREADY" || state === "OPEN") && !channel.funding_udt_type_script;
});
if (!readyChannel?.pubkey) {
  throw new Error("No ready CKB channel with a payment target was found");
}

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FIBER_RPC_URL: rpcUrl,
    FIBER_PAYMENT_PROOF_ENABLED: "true",
    FIBER_PAYMENT_TARGET_PUBKEY: readyChannel.pubkey,
    FIBER_PAYMENT_MAX_CKB: "0.05",
    FIBER_PAYMENT_COOLDOWN_MS: "1",
    FIBER_PAYMENT_EXECUTION_ENABLED: "false",
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
  assert(snapshot.maxSendableCkb >= amountCkb, "ready channel must cover the proof amount");

  const proofResponse = await fetch(`${origin}/api/fiber/payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      amountCkb,
      requestId: `live-proof-${Date.now()}`,
      execute: false,
    }),
  });
  const proof = await proofResponse.json();
  assert(proofResponse.ok, proof.error || `payment proof returned HTTP ${proofResponse.status}`);
  assert(proof.proofReady === true, "proofReady must be true");
  assert(proof.mode === "dry-run", "proof must remain dry-run");
  assert(proof.settled === false, "dry-run must never be marked settled");
  assert(Boolean(proof.paymentHash), "proof must include a redacted payment hash");

  const evidence = {
    generatedAt: new Date().toISOString(),
    network: snapshot.node?.network ?? "unknown",
    nodeReachable: snapshot.reachable,
    peerCount: snapshot.peerCount,
    readyChannels: snapshot.channels.filter((channel) => channel.state === "ready").length,
    maxSendableCkb: snapshot.maxSendableCkb,
    maxReceivableCkb: snapshot.maxReceivableCkb,
    proof,
  };
  const artifacts = resolve("artifacts");
  await mkdir(artifacts, { recursive: true });
  const outputPath = resolve(artifacts, "fiber-live-proof.json");
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(`PASS live Fiber snapshot: ${evidence.network}, ${evidence.readyChannels} ready channel(s)`);
  console.log(`PASS ${amountCkb} CKB route proof: ${proof.status}, fee ${proof.fee ?? "unknown"}`);
  console.log("PASS dry-run receipt is explicitly unsettled");
  console.log(`Evidence: ${outputPath}`);
} finally {
  server.kill();
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

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
