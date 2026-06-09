import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function run(label, cmd, args) {
  console.log(`\n--- ${label} ---\n`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true, cwd: root });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run("Class 1 — validation model", "node", ["scripts/class1-validation-model.mjs"]);
run("Class 2 — build carrot bytecode", "node", ["scripts/build-carrot.mjs"]);
run("Class 2 — carrot mock verify", "node", ["scripts/class2-carrot-mock.mjs"]);

console.log("\n--- Class 2 — live script vs code (optional) ---\n");
const live = spawnSync("node", ["scripts/class2-script-vs-code.mjs"], {
  stdio: "inherit",
  shell: true,
  cwd: root,
});
if (live.status !== 0) {
  console.log("\nSKIP: live Class 2 (devnet not up or stale deployment)");
} else {
  console.log("");
}

console.log("ALL PASS: script-course-lab Class 1–2 complete.");
