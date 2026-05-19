import { ccc } from "@ckb-ccc/core";

const network = process.argv[2] ?? "testnet";
const client =
  network === "mainnet"
    ? new ccc.ClientPublicMainnet()
    : new ccc.ClientPublicTestnet();

const bytes = crypto.getRandomValues(new Uint8Array(32));
const priv =
  "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const signer = new ccc.SignerCkbPrivateKey(client, priv);
const addr = await signer.getRecommendedAddress();

console.log("network:", network);
console.log("address:", addr);
console.log("(demo key — do not use on mainnet with real funds)");
console.log("PASS: address derived from secp256k1 key material.");
