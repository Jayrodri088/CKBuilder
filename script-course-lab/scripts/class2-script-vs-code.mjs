import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ckbRpc, rpcUrl } from "../lib/rpc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsPath = path.join(
  __dirname,
  "..",
  "..",
  "simple-lock",
  "frontend",
  "deployment",
  "scripts.json",
);

console.log("=== Class 2: Script vs script code (live devnet) ===");
console.log("Reference: https://docs.nervos.org/docs/script-course/intro-to-script-2\n");

if (!fs.existsSync(scriptsPath)) {
  throw new Error("simple-lock deployment missing — deploy hash-lock first");
}

const scripts = JSON.parse(fs.readFileSync(scriptsPath, "utf8"));
const meta = scripts.devnet?.["hash-lock.bc"];
if (!meta) throw new Error("hash-lock.bc not in scripts.json");

const dep = meta.cellDeps?.[0]?.cellDep?.outPoint;
if (!dep) throw new Error("missing cell dep outpoint");

const indexHex = `0x${Number(dep.index).toString(16)}`;
const live = await ckbRpc("get_live_cell", [{ tx_hash: dep.txHash, index: indexHex }, true]);

console.log("RPC:", rpcUrl());
console.log("\nOn-chain Script struct (from scripts.json):");
console.log("  codeHash :", meta.codeHash);
console.log("  hashType :", meta.hashType);
console.log("  args     : (per-user lock params — hash in hash-lock demo)");

console.log("\nScript code cell (cell dep — bytecode lives here):");
console.log("  outPoint :", dep.txHash, "index", dep.index);
console.log("  status   :", live?.status);
console.log("  capacity :", live?.cell?.capacity);

if (live?.status !== "live") {
  throw new Error("code cell not live — redeploy simple-lock on this devnet");
}

console.log("\nClass 2 distinction:");
console.log("  Script     = pointer (code_hash + hash_type + args)");
console.log("  Script code = bytes in dep cell data (hash-lock.bc on chain)");
console.log("\nPASS: live cell dep proves script code is a separate on-chain artifact.");
