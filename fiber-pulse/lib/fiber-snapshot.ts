export type FiberChannelSnapshot = {
  id: string;
  peer: string;
  state: "ready" | "pending" | "closing" | "closed";
  asset: string;
  sendableCkb: number;
  receivableCkb: number;
};

export type FiberSnapshot = {
  reachable: boolean;
  checkedAt: string;
  node?: {
    alias: string;
    network: string;
    version?: string;
    synced: boolean;
  };
  peerCount: number;
  channels: FiberChannelSnapshot[];
  maxSendableCkb: number;
  maxReceivableCkb: number;
  error?: string;
};
