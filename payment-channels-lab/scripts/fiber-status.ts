import {
  DEFAULT_FIBER_RPC,
  getNodeInfo,
  listChannels,
} from "../lib/fiber-rpc.js";

async function main() {
  const url = process.env.FIBER_RPC_URL ?? DEFAULT_FIBER_RPC;
  console.log("=== Live Fiber node probe ===");
  console.log("RPC:", url);

  const info = await getNodeInfo({ url });
  console.log("node_info:", JSON.stringify(info, null, 2));

  const channels = await listChannels({ url });
  const list = channels.channels ?? [];
  console.log("channels:", list.length);
  for (const ch of list.slice(0, 5)) {
    console.log(
      `  - ${ch.channel_id?.slice(0, 18)}… state=${ch.state_name} local=${ch.local_balance} remote=${ch.remote_balance}`,
    );
  }
  console.log("\nPASS: Fiber RPC reachable (payment channel network is up).");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  console.error(
    "\nHint: start a Fiber node (testnet/local) and expose JSON-RPC, e.g. http://127.0.0.1:8227",
  );
  console.error("Docs: https://docs.fiber.world/docs/quick-start/basic-transfer");
  process.exit(1);
});
