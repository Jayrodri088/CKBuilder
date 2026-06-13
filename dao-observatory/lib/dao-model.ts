export const LOCK_PERIOD_EPOCHS = 180;
export const EPOCHS_PER_YEAR = 2190;
export const SHANNONS_PER_CKB = 100_000_000n;
export const AR_SCALE = 10_000_000_000_000_000n;

export type DaoPhase = "wallet" | "deposited" | "withdrawing" | "withdrawn";

export type DaoState = {
  phase: DaoPhase;
  wallet: bigint;
  depositCapacity: bigint;
  occupiedCapacity: bigint;
  depositEpoch: number;
  currentEpoch: number;
  withdrawEpoch?: number;
  claimEpoch?: number;
  depositAr?: bigint;
  withdrawAr?: bigint;
  annualRateBps: number;
  depositBlockNumber?: number;
};

export function ckb(value: number): bigint {
  return BigInt(Math.round(value * Number(SHANNONS_PER_CKB)));
}

export function formatCkb(value: bigint, precision = 2): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SHANNONS_PER_CKB;
  const fraction = absolute % SHANNONS_PER_CKB;
  const fractionText = fraction.toString().padStart(8, "0").slice(0, precision);
  return `${negative ? "-" : ""}${whole.toLocaleString()}${precision ? `.${fractionText}` : ""}`;
}

export function initialState(): DaoState {
  return {
    phase: "wallet",
    wallet: ckb(25_000),
    depositCapacity: 0n,
    occupiedCapacity: ckb(102),
    depositEpoch: 1_000,
    currentEpoch: 1_000,
    annualRateBps: 280,
  };
}

export function arAtEpoch(state: DaoState, epoch: number): bigint {
  const elapsed = Math.max(0, epoch - state.depositEpoch);
  const growth =
    (AR_SCALE * BigInt(state.annualRateBps) * BigInt(elapsed)) /
    (10_000n * BigInt(EPOCHS_PER_YEAR));
  return AR_SCALE + growth;
}

export function calculateMaximumWithdraw(
  originalCapacity: bigint,
  occupiedCapacity: bigint,
  depositAr: bigint,
  withdrawAr: bigint,
): bigint {
  if (originalCapacity < occupiedCapacity) {
    throw new Error("Capacity cannot be below the cell's occupied capacity.");
  }
  if (depositAr <= 0n || withdrawAr < depositAr) {
    throw new Error("Invalid DAO accumulate-rate pair.");
  }
  const countedCapacity = originalCapacity - occupiedCapacity;
  return occupiedCapacity + (countedCapacity * withdrawAr) / depositAr;
}

export function nextClaimEpoch(depositEpoch: number, withdrawEpoch: number): number {
  if (withdrawEpoch <= depositEpoch) {
    throw new Error("The withdrawal request must follow the deposit.");
  }
  const elapsed = withdrawEpoch - depositEpoch;
  return depositEpoch + Math.max(1, Math.ceil(elapsed / LOCK_PERIOD_EPOCHS)) * LOCK_PERIOD_EPOCHS;
}

export function compensation(state: DaoState): bigint {
  if (!state.depositAr) return 0n;
  const endAr =
    state.phase === "withdrawing" || state.phase === "withdrawn"
      ? state.withdrawAr!
      : arAtEpoch(state, state.currentEpoch);
  return (
    calculateMaximumWithdraw(
      state.depositCapacity,
      state.occupiedCapacity,
      state.depositAr,
      endAr,
    ) - state.depositCapacity
  );
}

export function deposit(state: DaoState, amount: bigint): DaoState {
  if (state.phase !== "wallet") throw new Error("A deposit is already active.");
  if (amount < state.occupiedCapacity) {
    throw new Error(`A standard DAO cell needs at least ${formatCkb(state.occupiedCapacity)} CKB.`);
  }
  if (amount > state.wallet) throw new Error("The wallet balance is too low.");
  return {
    ...state,
    phase: "deposited",
    wallet: state.wallet - amount,
    depositCapacity: amount,
    depositEpoch: state.currentEpoch,
    depositAr: arAtEpoch(state, state.currentEpoch),
    depositBlockNumber: 12_345_678,
  };
}

export function advanceEpochs(state: DaoState, epochs: number): DaoState {
  if (!Number.isInteger(epochs) || epochs <= 0) {
    throw new Error("Epoch advance must be a positive whole number.");
  }
  return { ...state, currentEpoch: state.currentEpoch + epochs };
}

export function requestWithdrawal(state: DaoState): DaoState {
  if (state.phase !== "deposited") throw new Error("Only a deposited cell can enter phase one.");
  const withdrawEpoch = state.currentEpoch;
  return {
    ...state,
    phase: "withdrawing",
    withdrawEpoch,
    claimEpoch: nextClaimEpoch(state.depositEpoch, withdrawEpoch),
    withdrawAr: arAtEpoch(state, withdrawEpoch),
  };
}

export function finalizeWithdrawal(state: DaoState): DaoState {
  if (state.phase !== "withdrawing") throw new Error("No withdrawing cell is available.");
  if (state.currentEpoch < state.claimEpoch!) {
    throw new Error(`Absolute epoch since has not reached ${state.claimEpoch}.`);
  }
  const released = calculateMaximumWithdraw(
    state.depositCapacity,
    state.occupiedCapacity,
    state.depositAr!,
    state.withdrawAr!,
  );
  return { ...state, phase: "withdrawn", wallet: state.wallet + released };
}

export function validateState(state: DaoState): void {
  if (state.phase === "deposited" && state.depositCapacity <= 0n) {
    throw new Error("Deposited phase requires a DAO cell.");
  }
  if (
    (state.phase === "withdrawing" || state.phase === "withdrawn") &&
    (!state.withdrawEpoch || !state.claimEpoch || !state.withdrawAr)
  ) {
    throw new Error("Withdrawal phases require both headers and a claim epoch.");
  }
  if (state.depositCapacity > 0n && state.depositCapacity < state.occupiedCapacity) {
    throw new Error("DAO capacity invariant failed.");
  }
}
