import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "..", "ckb-pay-link", "frontend", "deployment");
const destDir = path.join(root, "deployment");

for (const name of ["scripts.json", "system-scripts.json"]) {
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  if (!fs.existsSync(src)) {
    console.error("Missing", src);
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("Synced", name);
}
console.log("OK: deployment synced from ckb-pay-link");
