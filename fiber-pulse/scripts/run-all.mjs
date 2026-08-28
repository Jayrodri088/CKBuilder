import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, cmd, args, opts = {}) {
  console.log(`\n--- ${label} ---\n`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    cwd: root,
    ...opts,
  });
  if (res.status !== 0 && !opts.allowFail) process.exit(res.status ?? 1);
  return res.status ?? 0;
}

run("install", "pnpm", ["install"]);
run("pay-codec proof", "node", ["scripts/prove-codec.mjs"]);
run("L1 handoff proof", "node", ["scripts/prove-l1-handoff.mjs"]);
run("typecheck", "pnpm", ["exec", "tsc", "--noEmit"]);
run("build", "pnpm", ["run", "build"]);
run("fiber security proof", "node", ["scripts/prove-fiber-security.mjs"]);
run("fiber grant proof", "node", ["scripts/prove-fiber-grant.mjs"]);
run("fiber payment tracking proof", "node", ["scripts/prove-fiber-tracking.mjs"]);

console.log("\n--- live L1 (OffCKB) — skip if RPC down ---\n");
{
  const code = run("prove-l1-live", "node", ["scripts/prove-l1-live.mjs"], {
    allowFail: true,
  });
  if (code === 1) process.exit(1);
  if (code === 0) {
    const e2e = run(
      "prove-l1-fund-claim",
      "node",
      ["scripts/prove-l1-fund-claim.mjs"],
      { allowFail: true },
    );
    if (e2e === 1) process.exit(1);
  }
}

console.log("\n--- optional Fiber RPC (not required) ---\n");
run(
  "check:fiber",
  "powershell",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "./scripts/check-fiber-rpc.ps1"],
  { allowFail: true },
);

for (const rel of [
  "app/page.tsx",
  "lib/preflight.ts",
  "lib/mock-fiber.ts",
  "lib/mock-node.ts",
  "lib/pay-codec.ts",
  "lib/l1-fallback.ts",
  "lib/l1-lock.ts",
  "lib/session-grant.ts",
  "lib/server/rate-limit.ts",
  "lib/server/payment-grant.ts",
  "lib/server/payment-tracker.ts",
  "deployment/scripts.json",
  "components/QrCode.tsx",
  "components/InvoiceWatch.tsx",
  "components/PaymentTracker.tsx",
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`Missing ${rel}`);
    process.exit(1);
  }
}

console.log("\nALL PASS: fiber-pulse checks ok (week in progress).");
console.log("Run: pnpm run dev  →  http://127.0.0.1:3060\n");
