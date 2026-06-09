const DEFAULT_RPC = "http://127.0.0.1:28114";

export function rpcUrl() {
  return process.env.CKB_RPC_URL ?? DEFAULT_RPC;
}

export async function ckbRpc(method, params = []) {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return json.result;
}
