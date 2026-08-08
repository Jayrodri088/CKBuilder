/**
 * End-to-end L1 proof (no Fiber): derive lock → offckb deposit → claim with preimage.
 * Exit 0 on success; exit 2 if OffCKB/RPC unavailable; exit 1 on hard failure.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const RPC = process.env.CKB_RPC_URL ?? "http://127.0.0.1:28114";
/**
 * Claim amount. Hash-lock + ckb_js_vm args need ~108 CKB occupied for any
 * change cell, so deposit must be claim + ≥110 spare.
 */
const AMOUNT_CKB = process.env.PULSE_L1_AMOUNT ?? "200";
const DEPOSIT_CKB = process.env.PULSE_L1_DEPOSIT ?? "320";
/** OffCKB genesis account #1 — safe receiver for claim proof */
const CLAIM_TO =
  process.env.PULSE_CLAIM_TO ??
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew";

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stringToBytesHex(text) {
  const buf = Buffer.from(text, "utf8");
  return "0x" + buf.toString("hex");
}

async function main() {
  try {
    const tip = await rpc("get_tip_header");
    console.log("OK: CKB tip", tip.number);
  } catch (e) {
    console.log("SKIP: CKB RPC unreachable at", RPC, "-", e.message);
    process.exit(2);
  }

  const { hashCkb, hexFrom, hashTypeToBytes, ccc, KnownScript } =
    await import("@ckb-ccc/core");
  const scripts = JSON.parse(
    fs.readFileSync(path.join(root, "deployment/scripts.json"), "utf8"),
  );
  const systemScripts = JSON.parse(
    fs.readFileSync(path.join(root, "deployment/system-scripts.json"), "utf8"),
  );
  const meta = scripts.devnet?.["hash-lock.bc"];
  const jsVm = systemScripts.devnet?.ckb_js_vm;
  if (!meta?.codeHash || !jsVm?.script?.codeHash) {
    console.error("FAIL: missing hash-lock / ckb_js_vm in deployment/");
    process.exit(1);
  }

  const devnetScripts = {
    [KnownScript.Secp256k1Blake160]:
      systemScripts.devnet.secp256k1_blake160_sighash_all.script,
    [KnownScript.Secp256k1Multisig]:
      systemScripts.devnet.secp256k1_blake160_multisig_all.script,
    [KnownScript.AnyoneCanPay]: systemScripts.devnet.anyone_can_pay.script,
    [KnownScript.OmniLock]: systemScripts.devnet.omnilock.script,
    [KnownScript.XUdt]: systemScripts.devnet.xudt.script,
    [KnownScript.NervosDao]: systemScripts.devnet.dao.script,
  };

  const preimage = `pulse-e2e-${Date.now().toString(16)}`;
  const buffer = hexFrom(Array.from(preimage).map((c) => c.charCodeAt(0)));
  const hash = hashCkb(buffer).slice(2);
  const lockArgs =
    "0x0000" +
    meta.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(meta.hashType)).slice(2) +
    hash;

  const client = new ccc.ClientPublicTestnet({
    url: RPC,
    scripts: devnetScripts,
  });
  const lockScript = ccc.Script.from({
    codeHash: jsVm.script.codeHash,
    hashType: jsVm.script.hashType,
    args: lockArgs,
  });
  const lockAddress = ccc.Address.fromScript(lockScript, client).toString();
  console.log("OK: lock address", lockAddress);
  console.log("    preimage", preimage);
  console.log("    deposit ", DEPOSIT_CKB, "CKB → claim", AMOUNT_CKB, "CKB");

  console.log("\n--- offckb deposit ---\n");
  const dep = spawnSync(
    "offckb",
    ["deposit", lockAddress, DEPOSIT_CKB, "--network", "devnet"],
    { encoding: "utf8", shell: true, timeout: 120_000 },
  );
  if (dep.status !== 0) {
    console.error(dep.stdout || "");
    console.error(dep.stderr || "");
    console.error("FAIL: offckb deposit exited", dep.status);
    process.exit(1);
  }
  console.log((dep.stdout || "").trim() || "OK: deposit submitted");

  let funded = false;
  for (let i = 0; i < 30; i++) {
    const bal = await client.getBalance([lockScript]);
    const ckb = Number(bal) / 1e8;
    console.log(`  balance poll ${i + 1}: ${ckb} CKB`);
    if (ckb + 1e-9 >= Number(DEPOSIT_CKB)) {
      funded = true;
      break;
    }
    await sleep(2000);
  }
  if (!funded) {
    console.error("FAIL: lock never reached funded balance");
    process.exit(1);
  }
  console.log("OK: fund check funded");

  const toScript = (await ccc.Address.fromString(CLAIM_TO, client)).script;
  const readSigner = new ccc.SignerCkbScriptReadonly(client, lockScript);
  const tx = ccc.Transaction.from({
    outputs: [{ lock: toScript }],
    outputsData: [],
  });
  tx.outputs.forEach((output) => {
    output.capacity = ccc.fixedPointFrom(AMOUNT_CKB);
  });
  await tx.addCellDeps(meta.cellDeps[0].cellDep);
  await tx.addCellDeps(jsVm.script.cellDeps[0].cellDep);

  const occupiedSize = ccc.CellOutput.from({
    capacity: BigInt(1000),
    lock: lockScript,
  }).occupiedSize;
  await tx.completeInputsByCapacity(readSigner, ccc.fixedPointFrom(occupiedSize));

  const balanceDiff =
    (await tx.getInputsCapacity(client)) - tx.getOutputsCapacity();
  if (balanceDiff > ccc.Zero) {
    tx.addOutput({
      lock: lockScript,
      capacity: balanceDiff - BigInt(1000),
    });
  }

  tx.setWitnessArgsAt(
    0,
    new ccc.WitnessArgs(stringToBytesHex(preimage)),
  );

  const txHash = await client.sendTransaction(tx);
  console.log("OK: claim tx", txHash);

  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const bal = await client.getBalance([lockScript]);
    const ckb = Number(bal) / 1e8;
    console.log(`  post-claim lock balance: ${ckb} CKB`);
    if (ckb + 1e-9 < Number(AMOUNT_CKB)) {
      console.log("ALL PASS: prove-l1-fund-claim (deposit → funded → claim)");
      return;
    }
  }
  console.error("FAIL: lock still holds full amount after claim");
  process.exit(1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
