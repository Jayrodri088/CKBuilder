import { createDecipheriv, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { ccc } from "@ckb-ccc/core";

const EXPECTED_PAYER_LOCK_ARGS =
  "0x9aac91d3c1ca430b8a61af4854e8ebe671cee437";
const MAX_TESTNET_TRANSFER_CKB = 300;
const FEE_RATE = 1_000;

function readArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--broadcast") {
      values.set("broadcast", true);
      continue;
    }
    if (!argument.startsWith("--") || index + 1 >= argv.length) {
      throw new Error(`Invalid argument: ${argument}`);
    }
    values.set(argument.slice(2), argv[index + 1]);
    index += 1;
  }
  return values;
}

function decryptFnnKey(fileBytes, password) {
  if (fileBytes.length < 46 || fileBytes[0] !== 0) {
    throw new Error("Unsupported or malformed FNN key file");
  }

  const salt = fileBytes.subarray(1, 17);
  const nonce = fileBytes.subarray(17, 29);
  const encrypted = fileBytes.subarray(29);
  const ciphertext = encrypted.subarray(0, -16);
  const authTag = encrypted.subarray(-16);
  const passwordBytes = Buffer.from(password, "utf8");
  const derivedKey = scryptSync(passwordBytes, salt, 32, {
    N: 131_072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });

  try {
    const decipher = createDecipheriv("aes-256-gcm", derivedKey, nonce);
    decipher.setAuthTag(authTag);
    const privateKey = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    if (privateKey.length !== 32) {
      privateKey.fill(0);
      throw new Error("Decrypted FNN key has an invalid length");
    }
    return privateKey;
  } finally {
    passwordBytes.fill(0);
    derivedKey.fill(0);
  }
}

async function main() {
  const args = readArguments(process.argv.slice(2));
  const target = args.get("to");
  const amountText = args.get("amount") ?? "200";
  const keyPath = args.get("key") ?? "D:\\CKB\\fiber-node\\ckb\\key";
  const rpcUrl = args.get("rpc") ?? "https://testnet.ckb.dev/";
  const password = process.env.FIBER_SECRET_KEY_PASSWORD;

  if (!target) throw new Error("Missing required --to testnet address");
  if (!password) throw new Error("FIBER_SECRET_KEY_PASSWORD is not set");
  if (!/^\d+(\.\d{1,8})?$/.test(amountText)) {
    throw new Error("--amount must be a positive CKB value with at most 8 decimals");
  }

  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TESTNET_TRANSFER_CKB) {
    throw new Error(
      `--amount must be greater than 0 and at most ${MAX_TESTNET_TRANSFER_CKB} CKB`,
    );
  }

  const encryptedKey = await readFile(keyPath);
  const privateKey = decryptFnnKey(encryptedKey, password);
  let privateKeyHex;

  try {
    privateKeyHex = `0x${privateKey.toString("hex")}`;
    const client = new ccc.ClientPublicTestnet({ url: rpcUrl, fallbacks: [] });
    const signer = new ccc.SignerCkbPrivateKey(client, privateKeyHex);
    const sender = await signer.getAddressObjSecp256k1();
    const receiver = await ccc.Address.fromString(target, client);

    if (sender.script.args !== EXPECTED_PAYER_LOCK_ARGS) {
      throw new Error(
        "The decrypted key does not match the expected local Fiber payer lock",
      );
    }
    if (!target.startsWith("ckt1")) {
      throw new Error("Refusing to fund a non-testnet address");
    }

    const transaction = ccc.Transaction.from({
      outputs: [
        {
          capacity: ccc.fixedPointFrom(amountText),
          lock: receiver.script,
        },
      ],
      outputsData: ["0x"],
    });
    await transaction.completeInputsByCapacity(signer);
    await transaction.completeFeeBy(signer, FEE_RATE);

    console.log(`Network: CKB testnet`);
    console.log(`From: ${sender.toString()}`);
    console.log(`To: ${receiver.toString()}`);
    console.log(`Amount: ${amountText} CKB`);

    if (!args.get("broadcast")) {
      console.log("Dry run complete. Add --broadcast to submit the transaction.");
      return;
    }

    const transactionHash = await signer.sendTransaction(transaction);
    console.log(`Transaction: ${transactionHash}`);
    console.log(
      `Explorer: https://pudge.explorer.nervos.org/transaction/${transactionHash}`,
    );
  } finally {
    privateKey.fill(0);
    privateKeyHex = undefined;
  }
}

main().catch((error) => {
  console.error(`Funding failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
