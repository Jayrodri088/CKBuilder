/**
 * Fiber channel lifecycle states (from official transfer guide).
 * @see https://docs.fiber.world/docs/quick-start/basic-transfer
 */
export const FIBER_CHANNEL_STATES = [
  "Negotiating",
  "Collaborating",
  "AwaitingTxSignatures",
  "AwaitingChannelReady",
  "ChannelReady",
  "ShuttingDown",
  "Closed",
] as const;

export type FiberChannelState = (typeof FIBER_CHANNEL_STATES)[number];

const VALID_TRANSITIONS: Record<FiberChannelState, FiberChannelState[]> = {
  Negotiating: ["Collaborating", "ShuttingDown"],
  Collaborating: ["AwaitingTxSignatures", "ShuttingDown"],
  AwaitingTxSignatures: ["AwaitingChannelReady", "ShuttingDown"],
  AwaitingChannelReady: ["ChannelReady", "ShuttingDown"],
  ChannelReady: ["ShuttingDown"],
  ShuttingDown: ["Closed"],
  Closed: [],
};

export function canTransition(from: FiberChannelState, to: FiberChannelState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: FiberChannelState, to: FiberChannelState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid channel transition: ${from} -> ${to}`);
  }
}

/** Shannon helpers (1 CKB = 1e8 shannon). */
export const SHANNON_PER_CKB = 100_000_000n;

export function ckbToShannon(ckb: number): bigint {
  return BigInt(Math.round(ckb * Number(SHANNON_PER_CKB)));
}

export function shannonToCkb(shannon: bigint): string {
  const whole = shannon / SHANNON_PER_CKB;
  const frac = shannon % SHANNON_PER_CKB;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

export type PaymentChannelKind = "fiber" | "perun" | "l1-only";

export type StackComparisonRow = {
  kind: PaymentChannelKind;
  layer: string;
  settlement: string;
  throughput: string;
  trustModel: string;
  ckbRole: string;
};

export const STACK_COMPARISON: StackComparisonRow[] = [
  {
    kind: "l1-only",
    layer: "CKB L1 (verification layer)",
    settlement: "Every transfer is an on-chain transaction",
    throughput: "Limited by block space and consensus",
    trustModel: "Full chain consensus",
    ckbRole: "Native cell model, global verification",
  },
  {
    kind: "fiber",
    layer: "Fiber Network (PCN on CKB)",
    settlement: "Many off-chain updates; final balance on channel close (L1 tx)",
    throughput: "High among channel peers / routed hops",
    trustModel: "Hashed timelock / PTLC-style contracts + watchtowers",
    ckbRole: "Funding & settlement locks on CKB; payments off-chain",
  },
  {
    kind: "perun",
    layer: "Perun (state-channel framework)",
    settlement: "Off-chain state updates with on-chain dispute window",
    throughput: "High within channel; virtual channels possible",
    trustModel: "State proofs + challenge period on L1",
    ckbRole: "Can anchor state to CKB as another PCN approach",
  },
];
