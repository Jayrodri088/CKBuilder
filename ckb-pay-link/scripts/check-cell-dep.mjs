import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsJsonPath = path.join(
  __dirname,
  "..",
  "frontend",
  "deployment",
  "scripts.json",
);

const rpcUrl = process.env.CKB_RPC_URL ?? "http://127.0.0.1:28114";

function rpc(method, params) {
  return fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  }).then((r) => r.json());
}

async function main() {
  if (!fs.existsSync(scriptsJsonPath)) {
    throw new Error("Missing frontend/deployment/scripts.json — run: pnpm run sync:deployment");
  }
  const scripts = JSON.parse(fs.readFileSync(scriptsJsonPath, "utf8"));
  const dep = scripts.devnet?.["hash-lock.bc"]?.cellDeps?.[0]?.cellDep?.outPoint;
  if (!dep) {
    throw new Error("Missing devnet hash-lock cell dep in scripts.json");
  }

  const indexHex = `0x${Number(dep.index).toString(16)}`;
  const res = await rpc("get_live_cell", [{ tx_hash: dep.txHash, index: indexHex }, true]);
  if (res.error) throw new Error(`RPC error: ${res.error.message}`);

  console.log("RPC:", rpcUrl);
  console.log("cell dep tx:", dep.txHash);
  console.log("status:", res.result?.status);
  if (res.result?.status !== "live") {
    throw new Error("Cell dep not live — redeploy simple-lock and sync:deployment");
  }
  console.log("PASS: hash-lock cell dep is live on this devnet.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
