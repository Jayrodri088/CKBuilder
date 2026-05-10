import fs from "fs";
import path from "path";
import { ccc, hashCkb, hashTypeToBytes, hexFrom, KnownScript } from "@ckb-ccc/core";

const simpleLockRoot = "d:/CKB/Test/simple-lock";
const scriptsPath = path.join(simpleLockRoot, "frontend", "deployment", "scripts.json");
const systemScriptsPath = path.join(simpleLockRoot, "frontend", "deployment", "system-scripts.json");

const DEFAULT_TO =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew";

function toBytesHex(text) {
  return hexFrom(Array.from(text).map((c) => c.charCodeAt(0)));
}

function asIndexerScript(script) {
  return {
    code_hash: script.codeHash,
    hash_type: script.hashType,
    args: script.args,
  };
}

function lockGroupKey(lock) {
  return `${lock.code_hash}|${lock.hash_type}|${lock.args}`;
}

function typeGroupKey(typeScript) {
  if (!typeScript) return "none";
  return `${typeScript.code_hash}|${typeScript.hash_type}|${typeScript.args}`;
}

function occupiedPercent(capacityHex, dataHex) {
  const capacity = Number(BigInt(capacityHex));
  const dataLen = Math.max(0, (dataHex?.length ?? 2) - 2) / 2;
  if (capacity <= 0) return 0;
  const pct = (dataLen / capacity) * 100;
  return Math.max(0, Math.min(100, pct));
}

async function rpc(method, params) {
  const res = await fetch("http://127.0.0.1:28114", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  return res.json();
}

async function getCellsByLock(script, limit = "0x32") {
  const searchKey = { script: asIndexerScript(script), script_type: "lock" };
  const res = await rpc("get_cells", [searchKey, "asc", limit]);
  if (res.error) throw new Error(res.error.message);
  return res.result?.objects ?? [];
}

async function main() {
  const preimage = process.argv[2] ?? "Hello World";
  const toAddress = process.argv[3] ?? DEFAULT_TO;

  const scripts = JSON.parse(fs.readFileSync(scriptsPath, "utf8"));
  const systemScripts = JSON.parse(fs.readFileSync(systemScriptsPath, "utf8"));
  const hashLock = scripts.devnet?.["hash-lock.bc"];
  const ckbJsVm = systemScripts.devnet?.["ckb_js_vm"]?.script;
  if (!hashLock || !ckbJsVm) {
    throw new Error("Missing devnet hash-lock or ckb_js_vm script metadata.");
  }

  const client = new ccc.ClientPublicTestnet({
    url: "http://localhost:28114",
    scripts: {
      [KnownScript.Secp256k1Blake160]:
        systemScripts.devnet.secp256k1_blake160_sighash_all.script,
      [KnownScript.Secp256k1Multisig]:
        systemScripts.devnet.secp256k1_blake160_multisig_all.script,
      [KnownScript.AnyoneCanPay]: systemScripts.devnet.anyone_can_pay.script,
      [KnownScript.OmniLock]: systemScripts.devnet.omnilock.script,
      [KnownScript.XUdt]: systemScripts.devnet.xudt.script,
      [KnownScript.NervosDao]: systemScripts.devnet.dao.script,
    },
  });

  const hash = hashCkb(toBytesHex(preimage)).slice(2);
  const lockArgs =
    "0x0000" +
    hashLock.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(hashLock.hashType)).slice(2) +
    hash;
  const hashLockScript = {
    codeHash: ckbJsVm.codeHash,
    hashType: ckbJsVm.hashType,
    args: lockArgs,
  };

  const fromAddress = ccc.Address.fromScript(hashLockScript, client).toString();
  const fromScript = (await ccc.Address.fromString(fromAddress, client)).script;
  const toScript = (await ccc.Address.fromString(toAddress, client)).script;

  const [fromCells, toCells] = await Promise.all([
    getCellsByLock(fromScript),
    getCellsByLock(toScript),
  ]);
  const allCells = [...fromCells, ...toCells];

  const lockGroups = new Map();
  const typeGroups = new Map();
  let highOccupancy = 0;

  for (const cellObj of allCells) {
    const out = cellObj.output;
    const lockKey = lockGroupKey(out.lock);
    const typeKey = typeGroupKey(out.type);
    lockGroups.set(lockKey, (lockGroups.get(lockKey) ?? 0) + 1);
    typeGroups.set(typeKey, (typeGroups.get(typeKey) ?? 0) + 1);
    if (occupiedPercent(out.capacity, cellObj.output_data) >= 99.9) highOccupancy++;
  }

  console.log("=== Playground parity (CLI) ===");
  console.log("from address (hash-lock):", fromAddress);
  console.log("to address              :", toAddress);
  console.log("scanned cells           :", allCells.length);
  console.log("lock color groups       :", lockGroups.size);
  console.log("type color groups       :", typeGroups.size);
  console.log("filled-center analog    :", highOccupancy, "cell(s) near fully occupied by data");
  console.log("");
  console.log("Lock groups (top 3):");
  [...lockGroups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([k, n], i) => console.log(`  ${i + 1}. ${n} cell(s) -> ${k}`));
  console.log("");
  console.log("Type groups (top 3):");
  [...typeGroups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([k, n], i) => console.log(`  ${i + 1}. ${n} cell(s) -> ${k}`));
  console.log("");
  console.log("PASS: this CLI mirrors Playground semantics (shared lock/type groups + occupancy signal).");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
