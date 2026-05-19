import { ccc } from "@ckb-ccc/core";

const addrStr = process.argv[2];
if (!addrStr) {
  console.error("Usage: node parse-address.mjs <ckb-address>");
  process.exit(1);
}

const client = new ccc.ClientPublicTestnet();
const addr = await ccc.Address.fromString(addrStr, client);
console.log("address:", addrStr);
console.log("script:", JSON.stringify(addr.script, null, 2));
console.log("PASS: parsed address to lock script (Rust SDK Parse Address exercise).");
