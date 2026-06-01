export type FiberRpcConfig = {
  url: string;
};

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

export const DEFAULT_FIBER_RPC = "http://127.0.0.1:8227";

export function fiberRpcUrlFromEnv(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FIBER_RPC_URL) {
    return process.env.NEXT_PUBLIC_FIBER_RPC_URL;
  }
  return DEFAULT_FIBER_RPC;
}

/** Browser-safe: proxies via Next.js API route. */
export async function fiberRpc<T>(
  method: string,
  params: unknown[] = [],
  url?: string,
): Promise<T> {
  const res = await fetch("/api/fiber", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method,
      params,
      url: url ?? fiberRpcUrlFromEnv(),
    }),
  });
  const json = (await res.json()) as {
    result?: T;
    error?: { message: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Fiber proxy HTTP ${res.status}`);
  }
  if (json.error) throw new Error(json.error.message);
  if (json.result === undefined) throw new Error(`No result for ${method}`);
  return json.result;
}

export async function getNodeInfo(url?: string) {
  return fiberRpc<NodeInfo>("node_info", [], url);
}

export async function listChannels(url?: string) {
  return fiberRpc<{ channels: ChannelListItem[] }>("list_channels", [{}], url);
}

export function shannonToCkbDisplay(shannon: string | undefined): string {
  if (!shannon) return "—";
  const n = Number(shannon);
  if (!Number.isFinite(n)) return shannon;
  return `${n / 1e8} CKB`;
}
