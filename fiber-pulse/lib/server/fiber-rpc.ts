import type { FiberChannelSnapshot, FiberSnapshot } from "../fiber-snapshot";

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

const TESTNET_CHAIN_HASH =
  "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";

function configuredRpcUrl() {
  return process.env.FIBER_RPC_URL?.trim() || "http://127.0.0.1:8227";
}

async function rpc<T>(method: "node_info" | "list_channels" | "list_peers", params: unknown[] = []) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = process.env.FNN_AUTH_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(configuredRpcUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error(`Fiber RPC returned HTTP ${response.status}`);
  const body = (await response.json()) as JsonRpcResponse<T>;
  if (body.error) throw new Error(`${body.error.code}: ${body.error.message}`);
  if (body.result === undefined) throw new Error(`${method} returned no result`);
  return body.result;
}

function ckb(raw: unknown) {
  if (typeof raw === "number") return raw / 100_000_000;
  if (typeof raw !== "string") return 0;
  const shannons = raw.startsWith("0x") ? Number.parseInt(raw, 16) : Number(raw);
  return Number.isFinite(shannons) ? shannons / 100_000_000 : 0;
}

function short(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value : fallback;
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function channelState(raw: any): FiberChannelSnapshot["state"] {
  const state = String(raw.state?.state_name ?? raw.state_name ?? raw.state ?? "").toUpperCase();
  if (state === "CHANNELREADY" || state === "OPEN") return "ready";
  if (state.includes("CLOS") || state.includes("SHUTDOWN")) return "closing";
  if (state === "CLOSED") return "closed";
  return "pending";
}

function normalizeChannel(raw: any, index: number, connectedPeers: Set<string>): FiberChannelSnapshot {
  const asset = raw.asset ?? raw.asset_type ?? raw.udt_type_script ?? raw.funding_udt_type_script;
  const peer = raw.peer_id ?? raw.peerId ?? raw.remote_peer_id ?? raw.pubkey;
  return {
    id: short(raw.channel_id ?? raw.channelId, `channel-${index + 1}`),
    peer: short(peer, "configured-peer"),
    state: channelState(raw),
    enabled: raw.enabled !== false,
    connected: typeof peer === "string" && connectedPeers.has(peer),
    asset: asset ? String(asset) : "CKB",
    sendableCkb: ckb(raw.local_balance ?? raw.localBalance ?? raw.balance_local),
    receivableCkb: ckb(raw.remote_balance ?? raw.remoteBalance ?? raw.balance_remote),
  };
}

export async function fetchPublicFiberSnapshot(): Promise<FiberSnapshot> {
  const checkedAt = new Date().toISOString();
  try {
    const nodeRaw = await rpc<any>("node_info");
    const [channelsRaw, peersRaw] = await Promise.all([
      rpc<any>("list_channels", [{}]).catch(() => ({ channels: [] })),
      rpc<any>("list_peers", [{}]).catch(() => ({ peers: [] })),
    ]);
    const rawChannels = Array.isArray(channelsRaw) ? channelsRaw : channelsRaw.channels ?? [];
    const rawPeers = Array.isArray(peersRaw) ? peersRaw : peersRaw.peers ?? [];
    const connectedPeers = new Set<string>();
    for (const rawPeer of rawPeers) {
      const peer = rawPeer.pubkey ?? rawPeer.peer_id ?? rawPeer.peerId;
      if (typeof peer === "string") connectedPeers.add(peer);
    }
    const channels = rawChannels.map((channel: any, index: number) =>
      normalizeChannel(channel, index, connectedPeers),
    );
    const readyCkb = channels.filter(
      (channel: FiberChannelSnapshot) =>
        channel.state === "ready" && channel.enabled && channel.connected && channel.asset === "CKB",
    );
    const chainHash = nodeRaw.chain_hash ?? nodeRaw.chainHash;

    return {
      reachable: true,
      checkedAt,
      node: {
        alias: nodeRaw.alias ?? nodeRaw.node_name ?? "fiber-node",
        network:
          nodeRaw.network ?? nodeRaw.chain ??
          (chainHash === TESTNET_CHAIN_HASH ? "testnet" : "unknown"),
        version: nodeRaw.version,
        synced: nodeRaw.synced ?? nodeRaw.is_synced ?? true,
      },
      peerCount: rawPeers.length,
      channels,
      maxSendableCkb: readyCkb.reduce(
        (sum: number, channel: FiberChannelSnapshot) => sum + channel.sendableCkb,
        0,
      ),
      maxReceivableCkb: readyCkb.reduce(
        (sum: number, channel: FiberChannelSnapshot) => sum + channel.receivableCkb,
        0,
      ),
    };
  } catch (error) {
    return {
      reachable: false,
      checkedAt,
      peerCount: 0,
      channels: [],
      maxSendableCkb: 0,
      maxReceivableCkb: 0,
      error: error instanceof Error ? error.message : "Fiber RPC unreachable",
    };
  }
}
