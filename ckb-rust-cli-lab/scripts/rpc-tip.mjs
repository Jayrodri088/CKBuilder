import { ckbRpc, rpcUrl } from "../lib/rpc.mjs";

const tip = await ckbRpc("get_tip_block_number");
console.log("RPC:", rpcUrl());
console.log("tip_block_number:", tip);
console.log("PASS: RPC reachable (same role as CkbRpcClient::get_tip_block_number).");
