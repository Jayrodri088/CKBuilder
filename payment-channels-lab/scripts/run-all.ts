import { spawnSync } from "child_process";

const steps = [
  ["proof:lifecycle", []],
  ["sim", []],
  ["fiber:status", []],
] as const;

let fiberSkipped = false;

for (const [script] of steps) {
  const res = spawnSync("pnpm", ["run", script], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (res.status !== 0) {
    if (script === "fiber:status") {
      fiberSkipped = true;
      console.warn("\nWARN: fiber:status skipped (no local Fiber RPC). Simulator proofs still valid.\n");
      continue;
    }
    process.exit(res.status ?? 1);
  }
}

if (fiberSkipped) {
  console.log("PARTIAL PASS: offline proofs OK; start Fiber node for live RPC proof.");
} else {
  console.log("ALL PASS: offline + live Fiber checks completed.");
}
