import fs from "fs";
import path from "path";
import { ccc, hashCkb, hashTypeToBytes, hexFrom, KnownScript } from "@ckb-ccc/core";

const root = "d:/CKB/Test/simple-lock";
const scriptsPath = path.join(root, "frontend", "deployment", "scripts.json");
const systemScriptsPath = path.join(root, "frontend", "deployment", "system-scripts.json");

function toBytesHex(text) {
  return hexFrom(Array.from(text).map((c) => c.charCodeAt(0)));
}

async function main() {
  const preimage = process.argv[2] ?? "Hello World";
  const scripts = JSON.parse(fs.readFileSync(scriptsPath, "utf8"));
  const systemScripts = JSON.parse(fs.readFileSync(systemScriptsPath, "utf8"));

  const hashLock = scripts.devnet?.["hash-lock.bc"];
  const ckbJsVm = systemScripts.devnet?.["ckb_js_vm"]?.script;
  if (!hashLock || !ckbJsVm) {
    throw new Error("Missing devnet hash-lock or ckb_js_vm script metadata.");
  }

  const hash = hashCkb(toBytesHex(preimage)).slice(2);
  const lockArgs =
    "0x0000" +
    hashLock.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(hashLock.hashType)).slice(2) +
    hash;

  const lockScript = {
    codeHash: ckbJsVm.codeHash,
    hashType: ckbJsVm.hashType,
    args: lockArgs,
  };

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
  const address = ccc.Address.fromScript(lockScript, client).toString();

  console.log("=== Hash-lock derivation demo ===");
  console.log("preimage:", JSON.stringify(preimage));
  console.log("hash    :", hash);
  console.log("address :", address);
  console.log("PASS: lock address is deterministically derived from preimage + script metadata.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
