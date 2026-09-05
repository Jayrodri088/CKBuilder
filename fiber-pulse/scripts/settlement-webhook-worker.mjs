const intervalMs = boundedNumber(
  process.env.FIBER_SETTLEMENT_WORKER_INTERVAL_MS,
  5_000,
  250,
  60_000,
);
const batchSize = boundedNumber(
  process.env.FIBER_SETTLEMENT_WORKER_BATCH_SIZE,
  20,
  1,
  100,
);
const once = process.argv.includes("--once");
const { drainPendingFiberSettlements } = await import(
  "../lib/server/settlement-webhook.ts"
);
const { closeStateStores } = await import("../lib/server/state-store.ts");

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

do {
  try {
    const result = await drainPendingFiberSettlements(batchSize);
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...result }));
    if (!result.configured) {
      process.exitCode = 2;
      stopping = true;
    }
  } catch (error) {
    console.error(`Settlement worker failed: ${safeError(error)}`);
    if (once) process.exitCode = 1;
  }
  if (!once && !stopping) await sleep(intervalMs);
} while (!once && !stopping);

closeStateStores();

function boundedNumber(raw, fallback, minimum, maximum) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? Math.floor(value)
    : fallback;
}

function sleep(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function safeError(error) {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.replace(/[\r\n]/g, " ").slice(0, 200);
}
