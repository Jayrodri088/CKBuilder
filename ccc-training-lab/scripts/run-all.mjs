import { spawnSync } from "child_process";

const steps = [
  ["node", ["./scripts/check-cell-dep.mjs"]],
  ["node", ["./scripts/derive-hash-lock.mjs"]],
  ["node", ["./scripts/lifecycle-proof.mjs"]],
];

for (const [cmd, args] of steps) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

console.log("");
console.log("ALL PASS: CCC training lab checks completed.");
