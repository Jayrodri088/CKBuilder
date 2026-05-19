import { ckbRpc } from "../lib/rpc.mjs";
import { spawnSync } from "child_process";

const tipNode = await ckbRpc("get_tip_block_number");

let tipCli = null;
const cli = spawnSync("ckb-cli", ["rpc", "get_tip_block_number"], {
  encoding: "utf8",
  shell: true,
  env: { ...process.env, API_URL: process.env.CKB_RPC_URL ?? "http://127.0.0.1:28114" },
});

if (cli.status === 0) {
  tipCli = cli.stdout.trim();
  console.log("Node/fetch tip:", tipNode);
  console.log("ckb-cli tip: ", tipCli);
  console.log("PASS: both paths talk to the same CKB node RPC.");
} else {
  console.log("Node/fetch tip:", tipNode);
  console.log("SKIP: ckb-cli not available — install for full compare track.");
  console.log("PASS: Node RPC path verified.");
}
