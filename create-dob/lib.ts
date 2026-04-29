import { setSporeConfig, createSpore } from "@spore-sdk/core";
import { SPORE_CONFIG } from "./spore-config";
import { createDefaultLockWallet } from "./helper";
import { unpackToRawSporeData } from "@spore-sdk/core";
import { ccc, Script } from "@ckb-ccc/core";
import { cccClient } from "./ccc-client";

setSporeConfig(SPORE_CONFIG);

type Account = {
  lockScript: Script;
  address: string;
  pubKey: string;
};

export const generateAccountFromPrivateKey = async (
  privKey: string
): Promise<Account> => {
  const signer = new ccc.SignerCkbPrivateKey(cccClient, privKey);
  const lock = await signer.getAddressObjSecp256k1();
  return {
    lockScript: lock.script,
    address: lock.toString(),
    pubKey: signer.publicKey,
  };
};

export async function capacityOf(address: string): Promise<bigint> {
  const addr = await ccc.Address.fromString(address, cccClient);
  let balance = await cccClient.getBalance([addr.script]);
  return balance;
}

export async function createSporeDOB(
  privkey: string,
  content: Uint8Array
): Promise<{ txHash: string; outputIndex: number }> {
  const wallet = createDefaultLockWallet(privkey);

  const { txSkeleton, outputIndex } = await createSpore({
    data: {
      contentType: "image/jpeg",
      content,
    },
    toLock: wallet.lock,
    fromInfos: [wallet.address],
    config: SPORE_CONFIG,
  });

  const txHash = await wallet.signAndSendTransaction(txSkeleton);
  console.log(`Spore created at transaction: ${txHash}`);
  console.log(
    `Spore ID: ${
      txSkeleton.get("outputs").get(outputIndex)!.cellOutput.type!.args
    }`
  );
  return { txHash, outputIndex };
}

async function waitForSporeCell(txHash: string, indexHex: string, retries = 10, intervalMs = 1500) {
  for (let i = 0; i < retries; i++) {
    const cell = await cccClient.getCellLive({ txHash, index: indexHex }, true);
    if (cell != null) {
      return cell;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

export async function showSporeContent(txHash: string, index = 0) {
  const indexHex = "0x" + index.toString(16);
  const cell = await waitForSporeCell(txHash, indexHex);
  if (cell == null) {
    throw new Error("Spore cell not found yet. Wait a bit and try again.");
  }
  const sporeData = unpackToRawSporeData(cell.outputData);
  console.log("spore data: ", sporeData);
  return sporeData;
}

export function shannonToCKB(amount: bigint){
  return amount / 100000000n;
}
