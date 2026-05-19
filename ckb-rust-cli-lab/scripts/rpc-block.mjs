import { ckbRpc, rpcUrl } from "../lib/rpc.mjs";

const number = process.argv[2] ?? "0";
const block = await ckbRpc("get_block_by_number", [`0x${Number(number).toString(16)}`]);
console.log("RPC:", rpcUrl());
console.log("block.header.number:", block?.header?.number);
console.log("block.transactions:", block?.transactions?.length ?? 0);
console.log("PASS: get_block_by_number works.");
