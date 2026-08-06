import { ccc, hashCkb, hexFrom, hashTypeToBytes } from "@ckb-ccc/core";
import { cccClient, currentNetwork } from "./ccc-client";
import scripts from "../deployment/scripts.json";
import systemScripts from "../deployment/system-scripts.json";

const myScripts = scripts[currentNetwork] as Record<
  string,
  { codeHash: string; hashType: string; cellDeps: { cellDep: unknown }[] }
>;
const mySystemScripts = systemScripts[currentNetwork] as Record<
  string,
  { script: { codeHash: string; hashType: string; cellDeps: unknown[] } }
>;

export function scriptDeployed(): boolean {
  return myScripts["hash-lock.bc"] != null;
}

export function hashPreimage(preimage: string): string {
  const buffer = hexFrom(Array.from(preimage).map((c) => c.charCodeAt(0)));
  return hashCkb(buffer).slice(2);
}

/** Same hash-lock address derivation as ckb-pay-link. */
export function deriveLockAddress(preimage: string): {
  hash: string;
  address: string;
} {
  if (!scriptDeployed()) {
    throw new Error("hash-lock.bc missing from fiber-pulse/deployment/scripts.json");
  }
  const hash = hashPreimage(preimage);
  const meta = myScripts["hash-lock.bc"]!;
  const lockArgs =
    "0x0000" +
    meta.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(meta.hashType as never)).slice(2) +
    hash;
  const lockScript = {
    codeHash: mySystemScripts["ckb_js_vm"]!.script.codeHash,
    hashType: mySystemScripts["ckb_js_vm"]!.script.hashType,
    args: lockArgs,
  };
  const address = ccc.Address.fromScript(lockScript, cccClient).toString();
  return { hash, address };
}

export async function capacityOf(address: string): Promise<bigint> {
  const addr = await ccc.Address.fromString(address, cccClient);
  return cccClient.getBalance([addr.script]);
}

export function shannonToCkb(amount: bigint): string {
  return (Number(amount) / 1e8).toString();
}

function payLinkOrigin(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PAY_LINK_ORIGIN) {
    return process.env.NEXT_PUBLIC_PAY_LINK_ORIGIN.replace(/\/$/, "");
  }
  return "http://127.0.0.1:3000";
}

export function buildPayLinkPayerUrl(params: {
  address: string;
  amount: string;
  label: string;
}): string {
  const q = new URLSearchParams({
    view: "payer",
    address: params.address,
    amount: params.amount,
    label: params.label,
    from: "pulse",
  });
  return `${payLinkOrigin()}/?${q.toString()}`;
}

/** Merchant claim handoff — preimage must stay off shared payer links. */
export function buildPayLinkClaimUrl(params: {
  preimage: string;
  amount: string;
  label: string;
  address: string;
  claimTo?: string;
}): string {
  const q = new URLSearchParams({
    view: "claim",
    from: "pulse",
    preimage: params.preimage,
    amount: params.amount,
    label: params.label,
    address: params.address,
  });
  if (params.claimTo) q.set("claimTo", params.claimTo);
  return `${payLinkOrigin()}/?${q.toString()}`;
}

export type FundStatus = "waiting" | "funded" | "unknown";

export function fundStatus(
  balanceCkb: number | null,
  amountCkb: number,
): FundStatus {
  if (balanceCkb == null || Number.isNaN(balanceCkb)) return "unknown";
  return balanceCkb + 1e-9 >= amountCkb ? "funded" : "waiting";
}
