const url = process.env.FIBER_RPC_URL ?? "http://127.0.0.1:8227";

async function fiberRpc(method, params = []) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function main() {
  console.log("=== Fiber node probe (Phase A — read-only) ===");
  console.log("RPC:", url);

  const info = await fiberRpc("node_info");
  console.log("node_info:", JSON.stringify(info, null, 2));

  const { channels = [] } = await fiberRpc("list_channels", [{}]);
  console.log("channels:", channels.length);
  for (const ch of channels.slice(0, 8)) {
    console.log(
      `  - ${(ch.channel_id ?? "?").slice(0, 20)}… state=${ch.state_name} local=${ch.local_balance} remote=${ch.remote_balance}`,
    );
  }
  console.log("\nPASS: Fiber RPC reachable (L2 rail probe only — payments not implemented yet).");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  console.error("Docs: https://docs.fiber.world/docs/quick-start/basic-transfer");
  process.exit(1);
});
