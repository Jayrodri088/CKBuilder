import { ccc, hexFrom, hashTypeToBytes } from "@ckb-ccc/core";
import { cccClient, currentNetwork } from "./ccc-client";
import scripts from "../deployment/scripts.json";
import systemScripts from "../deployment/system-scripts.json";

const myScripts = scripts[currentNetwork] as Record<string, unknown>;
const mySystemScripts = systemScripts[currentNetwork] as Record<
  string,
  { script: { codeHash: string; hashType: string; cellDeps: { cellDep: unknown }[] } }
>;

export function generatePreimage(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `pay-${hex}`;
}

export function uint8ArrayToHexString(uint8Array: Uint8Array): string {
  return Array.prototype.map
    .call(uint8Array, (x: number) => ("00" + x.toString(16)).slice(-2))
    .join("");
}

export function stringToBytesHex(text: string) {
  const buf = new TextEncoder().encode(text);
  return "0x" + uint8ArrayToHexString(buf);
}

export async function capacityOf(address: string): Promise<bigint> {
  const addr = await ccc.Address.fromString(address, cccClient);
  return cccClient.getBalance([addr.script]);
}

export async function wait(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function shannonToCKB(amount: bigint) {
  return amount / BigInt(100_000_000);
}

export function generateAccount(hash: string) {
  const meta = myScripts["hash-lock.bc"] as { codeHash: string; hashType: string };
  const lockArgs =
    "0x0000" +
    meta.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(meta.hashType)).slice(2) +
    hash;
  const lockScript = {
    codeHash: mySystemScripts["ckb_js_vm"]!.script.codeHash,
    hashType: mySystemScripts["ckb_js_vm"]!.script.hashType,
    args: lockArgs,
  };
  const address = ccc.Address.fromScript(lockScript, cccClient).toString();
  return {
    address,
    lockScript: ccc.Script.from(lockScript),
  };
}

export async function claimPayment(
  fromAddr: string,
  toAddr: string,
  amountInCKB: string,
  preimage: string,
): Promise<string> {
  const fromScript = (await ccc.Address.fromString(fromAddr, cccClient)).script;
  const toScript = (await ccc.Address.fromString(toAddr, cccClient)).script;
  const readSigner = new ccc.SignerCkbScriptReadonly(cccClient, fromScript);

  const tx = ccc.Transaction.from({
    outputs: [{ lock: toScript }],
    outputsData: [],
  });

  tx.outputs.forEach((output, i) => {
    if (output.capacity > ccc.fixedPointFrom(amountInCKB)) {
      throw new Error(`Insufficient capacity at output ${i}`);
    }
    output.capacity = ccc.fixedPointFrom(amountInCKB);
  });

  const hashLockMeta = myScripts["hash-lock.bc"] as {
    cellDeps: { cellDep: unknown }[];
  };
  await tx.addCellDeps(hashLockMeta.cellDeps[0].cellDep as never);
  await tx.addCellDeps(
    mySystemScripts["ckb_js_vm"]!.script.cellDeps[0].cellDep as never,
  );

  const occupiedSize = ccc.CellOutput.from({
    capacity: BigInt(1000),
    lock: fromScript,
  }).occupiedSize;

  await tx.completeInputsByCapacity(
    readSigner,
    ccc.fixedPointFrom(occupiedSize),
  );

  const balanceDiff =
    (await tx.getInputsCapacity(cccClient)) - tx.getOutputsCapacity();
  if (balanceDiff > ccc.Zero) {
    tx.addOutput({
      lock: fromScript,
      capacity: balanceDiff - BigInt(1000),
    });
  }

  tx.setWitnessArgsAt(
    0,
    new ccc.WitnessArgs(stringToBytesHex(preimage) as `0x${string}`),
  );

  return cccClient.sendTransaction(tx);
}

export function buildPayerUrl(params: {
  address: string;
  amount: string;
  label: string;
}): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams({
    view: "payer",
    address: params.address,
    amount: params.amount,
    label: params.label,
  });
  return `${window.location.origin}/?${q.toString()}`;
}

export function scriptDeployed(): boolean {
  return myScripts["hash-lock.bc"] != null;
}
