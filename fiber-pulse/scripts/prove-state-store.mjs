import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databaseFile = resolve(".data", `state-store-proof-${process.pid}.sqlite`);
const trackerFile = resolve(".data", `state-store-tracker-${process.pid}.json`);
const legacyFile = resolve(".data", `state-store-legacy-${process.pid}.json`);

process.env.FIBER_STATE_DB_PATH = databaseFile;
process.env.FIBER_PAYMENT_TRACKER_FILE = trackerFile;
process.env.FIBER_PAYMENT_GRANT_SECRET = "state-store-proof-secret-that-is-long-enough";

const [stateStore, rateLimit, grants, tracker] = await Promise.all([
  import("../lib/server/state-store.ts"),
  import("../lib/server/rate-limit.ts"),
  import("../lib/server/payment-grant.ts"),
  import("../lib/server/payment-tracker.ts"),
]);

try {
  stateStore.mutateState("rollback-proof", { value: 0 }, (state) => { state.value = 1; });
  try {
    stateStore.mutateState("rollback-proof", { value: 0 }, (state) => {
      state.value = 2;
      throw new Error("intentional rollback");
    });
  } catch {
    // Expected rollback.
  }
  assert(
    stateStore.readState("rollback-proof", { value: 0 }).value === 1,
    "failed transaction must preserve the committed value",
  );

  const cooldownKey = `state-proof-${process.pid}`;
  assert(rateLimit.claimCooldown(cooldownKey, 60_000).ok, "first cooldown claim must succeed");
  assert(!rateLimit.claimCooldown(cooldownKey, 60_000).ok, "second cooldown claim must be atomic");

  const issued = grants.issuePaymentGrant({
    requestId: "state-store-proof",
    amountCkb: 0.01,
    invoice: "fibt1-state-store-proof",
  });
  const grantInput = {
    token: issued.grant,
    requestId: "state-store-proof",
    amountCkb: 0.01,
    invoice: "fibt1-state-store-proof",
  };
  assert(grants.assertPaymentGrant(grantInput).ok, "stored grant must validate");
  assert(grants.consumePaymentGrant(grantInput).ok, "stored grant must be consumed once");
  assert(!grants.consumePaymentGrant(grantInput).ok, "consumed grant must reject reuse");

  const tracked = tracker.registerTrackedPayment({
    paymentHash: `0x${"42".repeat(32)}`,
    requestId: "state-store-proof",
    amountCkb: 0.01,
    status: "Created",
  });
  assert(tracker.findTrackedPayment(tracked.id).state === "found", "tracked payment must persist");
  tracker.updateTrackedPayment(tracked.id, { status: "Success", fee: "0x0" });
  const reconciled = tracker.findTrackedPayment(tracked.id);
  assert(
    reconciled.state === "found" && reconciled.record.status === "Success",
    "tracked payment update must persist",
  );

  mkdirSync(dirname(legacyFile), { recursive: true });
  writeFileSync(legacyFile, JSON.stringify({ imported: true }));
  const migrated = stateStore.readState(
    "legacy-proof",
    { imported: false },
    { file: legacyFile },
  );
  rmSync(legacyFile, { force: true });
  assert(migrated.imported, "legacy JSON state must import on first SQLite access");
  assert(
    stateStore.readState("legacy-proof", { imported: false }).imported,
    "imported state must remain available after the legacy file is removed",
  );

  console.log("PASS failed state mutation rolls back atomically");
  console.log("PASS cooldown claim is serialized in SQLite");
  console.log("PASS payment grant consumption is one-time and transactional");
  console.log("PASS payment tracking persists and updates through shared state");
  console.log("PASS legacy JSON state imports on first database access");
} finally {
  stateStore.closeStateStores();
  for (const file of [databaseFile, `${databaseFile}-wal`, `${databaseFile}-shm`, trackerFile, legacyFile]) {
    rmSync(file, { force: true });
  }
  delete process.env.FIBER_STATE_DB_PATH;
  delete process.env.FIBER_PAYMENT_TRACKER_FILE;
  delete process.env.FIBER_PAYMENT_GRANT_SECRET;
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
}
