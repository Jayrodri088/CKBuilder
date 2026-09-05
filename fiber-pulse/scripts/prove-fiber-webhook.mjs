import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const secret = "settlement-proof-secret-that-is-long-enough";
const outboxFile = resolve(".data", `settlement-webhook-proof-${process.pid}.json`);
const databaseFile = resolve(".data", `fiber-state-proof-${process.pid}.sqlite`);
const execFileAsync = promisify(execFile);
let requests = 0;
const attempts = new Map();

const receiver = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    requests += 1;
    const body = Buffer.concat(chunks).toString("utf8");
    const timestamp = String(request.headers["x-fiber-pulse-timestamp"] ?? "");
    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const supplied = String(request.headers["x-fiber-pulse-signature"] ?? "").replace(/^sha256=/, "");
    assert(safeEqual(supplied, expected), "webhook signature must cover timestamp and exact body");

    const payload = JSON.parse(body);
    assert(payload.event === "fiber.invoice.settled", "event type must identify settlement");
    assert(payload.status === "paid", "webhook must represent only confirmed settlement");
    assert(!body.includes("fibt1"), "encoded invoice must not leave the merchant server");
    assert(!("paymentHash" in payload) && !("payee" in payload), "private payment fields must be omitted");
    assert(request.headers["idempotency-key"] === payload.eventId, "event ID must be the idempotency key");

    const count = (attempts.get(payload.eventId) ?? 0) + 1;
    attempts.set(payload.eventId, count);
    if (payload.description === "dead-order" || (payload.description === "retry-order" && count === 1)) {
      response.writeHead(503).end("retry");
      return;
    }
    response.writeHead(204).end();
  });
});

await new Promise((resolveListen) => receiver.listen(0, "127.0.0.1", resolveListen));
const address = receiver.address();
if (!address || typeof address === "string") throw new Error("Proof receiver did not bind a TCP port");

process.env.FIBER_SETTLEMENT_WEBHOOK_URL = `http://127.0.0.1:${address.port}/fiber-events`;
process.env.FIBER_SETTLEMENT_WEBHOOK_SECRET = secret;
process.env.FIBER_SETTLEMENT_WEBHOOK_ALLOW_HTTP_LOOPBACK = "true";
process.env.FIBER_SETTLEMENT_WEBHOOK_RETRY_BASE_MS = "1";
process.env.FIBER_SETTLEMENT_WEBHOOK_STORE_FILE = outboxFile;
process.env.FIBER_STATE_DB_PATH = databaseFile;

try {
  const [{ notifyFiberSettlement }, { channelState }, stateStore] = await Promise.all([
    import("../lib/server/settlement-webhook.ts"),
    import("../lib/server/fiber-rpc.ts"),
    import("../lib/server/state-store.ts"),
  ]);

  assert(stateStore.stateStoreMode() === "sqlite", "proof must exercise SQLite state mode");
  stateStore.mutateState("transaction-proof", { value: 0 }, (state) => { state.value = 1; });
  try {
    stateStore.mutateState("transaction-proof", { value: 0 }, (state) => {
      state.value = 2;
      throw new Error("rollback proof");
    });
  } catch {
    // Expected rollback.
  }
  assert(
    stateStore.readState("transaction-proof", { value: 0 }).value === 1,
    "failed mutation must roll back",
  );

  const firstInput = settlement("fibt1-proof-invoice-one", "order-1042");
  const first = await notifyFiberSettlement(firstInput);
  const duplicate = await notifyFiberSettlement(firstInput);
  assert(first.state === "delivered", "successful callback must be marked delivered");
  assert(duplicate.state === "delivered", "duplicate settlement must reuse delivered state");
  assert(requests === 1, "duplicate settlement polling must not send a second callback");

  const retryInput = settlement("fibt1-proof-invoice-two", "retry-order");
  const pending = await notifyFiberSettlement(retryInput);
  assert(pending.state === "pending" && pending.attempts === 1, "failed callback must enter retry state");
  await sleep(5);
  const worker = await execFileAsync(
    process.execPath,
    [
      "--no-warnings",
      "--experimental-strip-types",
      resolve("scripts", "settlement-webhook-worker.mjs"),
      "--once",
    ],
    { cwd: process.cwd(), env: process.env, timeout: 20_000, windowsHide: true },
  );
  const workerResult = JSON.parse(worker.stdout.trim());
  assert(workerResult.delivered === 1, "separate worker process must deliver the due event");
  const retried = await notifyFiberSettlement(retryInput);
  assert(retried.state === "delivered" && retried.attempts === 2, "worker retry must preserve event and deliver");

  process.env.FIBER_SETTLEMENT_WEBHOOK_MAX_ATTEMPTS = "1";
  const deadInput = settlement("fibt1-proof-invoice-dead", "dead-order");
  const dead = await notifyFiberSettlement(deadInput);
  const deadDuplicate = await notifyFiberSettlement(deadInput);
  assert(dead.state === "failed" && dead.attempts === 1, "attempt ceiling must move delivery to failed");
  assert(deadDuplicate.state === "failed", "dead-lettered event must remain terminal");
  assert(requests === 4, "dead-lettered event must not be delivered again by polling");

  process.env.FIBER_SETTLEMENT_WEBHOOK_URL = "http://example.com/fiber-events";
  const unsafe = await notifyFiberSettlement(settlement("fibt1-proof-invoice-three", "unsafe-order"));
  assert(unsafe.state === "misconfigured", "non-HTTPS non-loopback destination must fail closed");
  assert(requests === 4, "unsafe destination must not receive a request");

  assert(
    channelState({ state: { state_name: "NegotiatingFunding" }, failure_detail: "Peer disconnected" }) === "failed",
    "channel failure detail must override an in-progress state",
  );
  assert(
    channelState({ state: { state_name: "ChannelReady" }, failure_detail: null }) === "ready",
    "ready channels must remain ready",
  );

  console.log("PASS settlement webhook signature covers timestamp and exact payload");
  console.log("PASS failed SQLite mutation rolls back atomically");
  console.log("PASS webhook payload excludes invoice and private payment fields");
  console.log("PASS duplicate settlement polling emits one idempotent event");
  console.log("PASS separate worker retries the same event through shared WAL state");
  console.log("PASS retry ceiling moves an event to terminal failed state");
  console.log("PASS unsafe webhook destination fails closed");
  console.log("PASS failed channel negotiations no longer appear pending");
} finally {
  await new Promise((resolveClose) => receiver.close(resolveClose));
  const { closeStateStores } = await import("../lib/server/state-store.ts");
  closeStateStores();
  rmSync(outboxFile, { force: true });
  rmSync(databaseFile, { force: true });
  rmSync(`${databaseFile}-wal`, { force: true });
  rmSync(`${databaseFile}-shm`, { force: true });
  delete process.env.FIBER_SETTLEMENT_WEBHOOK_URL;
  delete process.env.FIBER_SETTLEMENT_WEBHOOK_SECRET;
  delete process.env.FIBER_SETTLEMENT_WEBHOOK_ALLOW_HTTP_LOOPBACK;
  delete process.env.FIBER_SETTLEMENT_WEBHOOK_RETRY_BASE_MS;
  delete process.env.FIBER_SETTLEMENT_WEBHOOK_MAX_ATTEMPTS;
  delete process.env.FIBER_SETTLEMENT_WEBHOOK_STORE_FILE;
  delete process.env.FIBER_STATE_DB_PATH;
}

function settlement(encodedInvoice, description) {
  return {
    encodedInvoice,
    invoice: {
      amountCkb: 0.01,
      currency: "Fibt",
      description,
      payee: "03b76e...1fed56",
      paymentHash: "0x1f6c...044c7f",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expired: false,
    },
  };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sleep(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
