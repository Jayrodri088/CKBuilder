import {
  assertTransition,
  ckbToShannon,
  shannonToCkb,
  type FiberChannelState,
} from "./channel-model.js";

export type Party = "alice" | "bob";

export type OffChainPayment = {
  from: Party;
  to: Party;
  amountShannon: bigint;
  at: number;
};

export type ChannelSimulator = {
  state: FiberChannelState;
  fundingShannon: bigint;
  localBalance: bigint;
  remoteBalance: bigint;
  payments: OffChainPayment[];
  onChainTxCount: number;
};

export function createChannel(fundingCkb: number): ChannelSimulator {
  const funding = ckbToShannon(fundingCkb);
  let state: FiberChannelState = "Negotiating";
  const advance = (next: FiberChannelState) => {
    assertTransition(state, next);
    state = next;
  };
  advance("Collaborating");
  advance("AwaitingTxSignatures");
  advance("AwaitingChannelReady");
  advance("ChannelReady");

  return {
    state,
    fundingShannon: funding,
    localBalance: funding,
    remoteBalance: 0n,
    payments: [],
    onChainTxCount: 1, // open channel funding tx
  };
}

export function payOffChain(
  channel: ChannelSimulator,
  from: Party,
  to: Party,
  amountCkb: number,
): ChannelSimulator {
  if (channel.state !== "ChannelReady") {
    throw new Error(`Channel not ready for payments (state=${channel.state})`);
  }
  if (from === to) throw new Error("from and to must differ");

  const amount = ckbToShannon(amountCkb);
  const isAlicePayer = from === "alice";

  const payerLocal = isAlicePayer ? channel.localBalance : channel.remoteBalance;
  if (amount > payerLocal) {
    throw new Error(
      `Insufficient local balance: need ${shannonToCkb(amount)} CKB, have ${shannonToCkb(payerLocal)} CKB`,
    );
  }

  let local = channel.localBalance;
  let remote = channel.remoteBalance;
  if (isAlicePayer) {
    local -= amount;
    remote += amount;
  } else {
    remote -= amount;
    local += amount;
  }

  return {
    ...channel,
    localBalance: local,
    remoteBalance: remote,
    payments: [
      ...channel.payments,
      { from, to, amountShannon: amount, at: Date.now() },
    ],
    // Off-chain: no new L1 transaction
    onChainTxCount: channel.onChainTxCount,
  };
}

export function closeChannel(channel: ChannelSimulator): {
  channel: ChannelSimulator;
  settlement: { aliceReceives: bigint; bobReceives: bigint };
} {
  let state = channel.state;
  if (state === "ChannelReady") {
    assertTransition(state, "ShuttingDown");
    state = "ShuttingDown";
    assertTransition(state, "Closed");
    state = "Closed";
  }

  const aliceReceives = channel.localBalance;
  const bobReceives = channel.remoteBalance;
  const total = aliceReceives + bobReceives;
  if (total !== channel.fundingShannon) {
    throw new Error(
      `Conservation violated: ${shannonToCkb(total)} != funding ${shannonToCkb(channel.fundingShannon)}`,
    );
  }

  return {
    channel: {
      ...channel,
      state,
      onChainTxCount: channel.onChainTxCount + 1,
    },
    settlement: { aliceReceives, bobReceives },
  };
}

export function summarize(channel: ChannelSimulator) {
  return {
    state: channel.state,
    fundingCkb: shannonToCkb(channel.fundingShannon),
    localCkb: shannonToCkb(channel.localBalance),
    remoteCkb: shannonToCkb(channel.remoteBalance),
    offChainPayments: channel.payments.length,
    onChainTxCount: channel.onChainTxCount,
  };
}
