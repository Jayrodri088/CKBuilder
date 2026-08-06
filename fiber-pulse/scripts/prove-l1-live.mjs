/**
 * Live L1 proof against OffCKB: RPC + cell dep + derive lock address from a Pulse preimage.
 * Exit 0 on success; exit 2 if RPC down (skip); exit 1 on hard failure.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const RPC = process.env.CKB_RPC_URL ?? "http://127.0.0.1:28114";

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    signal: AbortSignal.timeout(4000),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

async function main() {
  let tip;
  try {
    tip = await rpc("get_tip_header");
  } catch (e) {
    console.log("SKIP: CKB RPC unreachable at", RPC, "-", e.message);
    process.exit(2);
  }
  console.log("OK: CKB tip", tip.number);

  const scripts = JSON.parse(
    fs.readFileSync(path.join(root, "deployment/scripts.json"), "utf8"),
  );
  const dep = scripts.devnet?.["hash-lock.bc"]?.cellDeps?.[0]?.cellDep?.outPoint;
  if (!dep?.txHash) {
    console.error("FAIL: no hash-lock cell dep in deployment/scripts.json");
    process.exit(1);
  }

  const live = await rpc("get_live_cell", [
    { tx_hash: dep.txHash, index: `0x${Number(dep.index).toString(16)}` },
    true,
  ]);
  if (live?.status !== "live") {
    console.error("FAIL: hash-lock cell dep not live:", dep.txHash, live?.status);
    process.exit(1);
  }
  console.log("OK: hash-lock cell dep live", dep.txHash);

  // Derive via same formula as lib/l1-lock (hashCkb of preimage bytes)
  const { hashCkb, hexFrom, hashTypeToBytes, ccc } = await import("@ckb-ccc/core");
  const systemScripts = JSON.parse(
    fs.readFileSync(path.join(root, "deployment/system-scripts.json"), "utf8"),
  );
  const preimage = `pulse-live-${Date.now().toString(16)}`;
  const buffer = hexFrom(Array.from(preimage).map((c) => c.charCodeAt(0)));
  const hash = hashCkb(buffer).slice(2);
  const meta = scripts.devnet["hash-lock.bc"];
  const lockArgs =
    "0x0000" +
    meta.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(meta.hashType)).slice(2) +
    hash;
  const client = new ccc.ClientPublicTestnet({
    url: RPC,
    scripts: {},
  });
  const lockScript = {
    codeHash: systemScripts.devnet.ckb_js_vm.script.codeHash,
    hashType: systemScripts.devnet.ckb_js_vm.script.hashType,
    args: lockArgs,
  };
  const address = ccc.Address.fromScript(lockScript, client).toString();
  console.log("OK: derived L1 lock address");
  console.log("    preimage:", preimage);
  console.log("    address: ", address);
  console.log("ALL PASS: prove-l1-live");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
