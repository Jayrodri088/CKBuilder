export type FiberRpcConfig = {
  url: string;
};

export async function fiberRpc<T>(
  config: FiberRpcConfig,
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: Date.now(),
      jsonrpc: "2.0",
      method,
      params,
    }),
  });
  const json = (await res.json()) as {
    result?: T;
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message);
  if (json.result === undefined) throw new Error(`No result for ${method}`);
  return json.result;
}

export type NodeInfo = {
  version?: string;
  pubkey?: string;
  chain?: string;
};

export type ChannelListItem = {
  channel_id?: string;
  state_name?: string;
  local_balance?: string;
  remote_balance?: string;
  public?: boolean;
};

export async function getNodeInfo(config: FiberRpcConfig) {
  return fiberRpc<NodeInfo>(config, "node_info");
}

export async function listChannels(config: FiberRpcConfig) {
  return fiberRpc<{ channels: ChannelListItem[] }>(config, "list_channels", [
    {},
  ]);
}

export const DEFAULT_FIBER_RPC = "http://127.0.0.1:8227";
