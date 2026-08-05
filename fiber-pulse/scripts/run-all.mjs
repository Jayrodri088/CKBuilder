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
  "lib/session-grant.ts",
  "components/QrCode.tsx",
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`Missing ${rel}`);
    process.exit(1);
  }
}

console.log("\nALL PASS: fiber-pulse checks ok (week in progress).");
console.log("Run: pnpm run dev  →  http://127.0.0.1:3060\n");
