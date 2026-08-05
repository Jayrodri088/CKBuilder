export type MockChannel = {
  id: string;
  peerShort: string;
  localCkb: number;
  remoteCkb: number;
  state: "ready" | "pending";
};

export type MockNodeState = {
  mode: "mock" | "live";
  nodeId: string;
  version: string;
  feeShannon: number;
  channels: MockChannel[];
};

const STORAGE_KEY = "fiber-pulse.mock-node.v1";

function defaultChannels(): MockChannel[] {
  return [
    {
      id: "0x4a5e…eda3",
      peerShort: "peer·bottle",
      localCkb: 7.2,
      remoteCkb: 2.8,
      state: "ready",
    },
    {
      id: "0x91c2…11f0",
      peerShort: "peer·relay",
      localCkb: 2.5,
      remoteCkb: 5.5,
      state: "ready",
    },
    {
      id: "0x0bb1…88a2",
      peerShort: "peer·lsp",
      localCkb: 0.4,
      remoteCkb: 1.6,
      state: "pending",
    },
  ];
}

export function loadMockNode(): MockNodeState {
  if (typeof window === "undefined") {
    return {
      mode: "mock",
      nodeId: "pulse-mock",
      version: "mock-0.1",
      feeShannon: 4200,
      channels: defaultChannels(),
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockNodeState;
  } catch {
    /* ignore */
  }
  const fresh: MockNodeState = {
    mode: "mock",
    nodeId: "pulse-mock",
    version: "mock-0.1",
    feeShannon: 4200,
    channels: defaultChannels(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveMockNode(state: MockNodeState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function totalSendCkb(node: MockNodeState): number {
  return node.channels
    .filter((c) => c.state === "ready")
    .reduce((s, c) => s + c.localCkb, 0);
}

export function totalReceiveCkb(node: MockNodeState): number {
  return node.channels
    .filter((c) => c.state === "ready")
    .reduce((s, c) => s + c.remoteCkb, 0);
}

/** Apply outbound spend against the fattest ready channel. */
export function applyOutboundSpend(node: MockNodeState, amountCkb: number): MockNodeState {
  const channels = node.channels.map((c) => ({ ...c }));
  let left = amountCkb;
  for (const ch of channels) {
    if (left <= 0) break;
    if (ch.state !== "ready" || ch.localCkb <= 0) continue;
    const take = Math.min(ch.localCkb, left);
    ch.localCkb = +(ch.localCkb - take).toFixed(6);
    ch.remoteCkb = +(ch.remoteCkb + take).toFixed(6);
    left = +(left - take).toFixed(6);
  }
  const next = { ...node, channels };
  saveMockNode(next);
  return next;
}

export async function probeLiveNode(): Promise<{
  ok: boolean;
  version?: string;
  channelCount?: number;
  error?: string;
}> {
  try {
    const res = await fetch("/api/fiber", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "node_info", params: [] }),
    });
    const body = await res.json();
    if (!res.ok || body.error) {
      return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` };
    }
    let channelCount: number | undefined;
    try {
      const chRes = await fetch("/api/fiber", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "list_channels", params: [{}] }),
      });
      const chBody = await chRes.json();
      channelCount = chBody.result?.channels?.length ?? 0;
    } catch {
      channelCount = undefined;
    }
    return {
      ok: true,
      version: body.result?.version ?? "live",
      channelCount,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unreachable" };
  }
}
