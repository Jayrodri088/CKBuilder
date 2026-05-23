import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "..", "simple-lock", "frontend", "deployment");
const dest = path.join(root, "frontend", "deployment");

for (const name of ["scripts.json", "system-scripts.json"]) {
  const from = path.join(src, name);
  const to = path.join(dest, name);
  if (!fs.existsSync(from)) {
    console.error(`FAIL: missing ${from}`);
    console.error("Deploy simple-lock first or copy deployment JSON manually.");
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(from, to);
  console.log("OK: copied", name);
}
console.log("PASS: deployment synced from simple-lock.");
