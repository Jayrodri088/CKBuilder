import fs from "fs";
import path from "path";

const root = "d:/CKB/Test/simple-lock";
const scriptsJsonPath = path.join(root, "frontend", "deployment", "scripts.json");

function rpc(method, params) {
  return fetch("http://127.0.0.1:28114", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    }),
  }).then((r) => r.json());
}

async function main() {
  const scripts = JSON.parse(fs.readFileSync(scriptsJsonPath, "utf8"));
  const dep = scripts.devnet?.["hash-lock.bc"]?.cellDeps?.[0]?.cellDep?.outPoint;
  if (!dep) {
    throw new Error("Missing devnet hash-lock cell dep in frontend/deployment/scripts.json");
  }

  const indexHex = `0x${Number(dep.index).toString(16)}`;
  const res = await rpc("get_live_cell", [{ tx_hash: dep.txHash, index: indexHex }, true]);
  if (res.error) {
    throw new Error(`RPC error: ${res.error.message}`);
  }

  console.log("=== Cell dep liveness check ===");
  console.log("txHash:", dep.txHash);
  console.log("index :", dep.index);
  console.log("status:", res.result?.status);
  if (res.result?.status !== "live") {
    throw new Error("Cell dep is not live. Deploy/sync scripts.json before using hash-lock.");
  }
  console.log("PASS: current frontend hash-lock cell dep exists on this devnet.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
