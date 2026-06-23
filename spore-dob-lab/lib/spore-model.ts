import { decodeDob, normalizeDna, type DobObject } from "./dob";

export const SHANNONS_PER_CKB = 100_000_000n;
export const DEFAULT_OCCUPIED = 142n * SHANNONS_PER_CKB;
export const DEFAULT_MARGIN = 1n * SHANNONS_PER_CKB;
export const TRANSFER_FEE = 10_000n;
export const MELT_FEE = 20_000n;

export type Owner = "issuer" | "collector";
export type Phase = "empty" | "live" | "melted";

export type Wallets = Record<Owner, bigint>;

export type SporeCell = {
  id: string;
  owner: Owner;
  capacity: bigint;
  occupiedCapacity: bigint;
  capacityMargin: bigint;
  dna: string;
  contentType: string;
  typeScript: string;
  clusterId: string;
  transfers: number;
  melted: boolean;
};

export type SporeState = {
  phase: Phase;
  initialTotal: bigint;
  wallets: Wallets;
  feesPaid: bigint;
  nonce: number;
  cell?: SporeCell;
  history: string[];
};

export type TxAnatomy = {
  title: string;
  inputs: string[];
  outputs: string[];
  cellDeps: string[];
  witnesses: string[];
};

export function ckb(value: number): bigint {
  return BigInt(Math.round(value * Number(SHANNONS_PER_CKB)));
}

export function formatCkb(value: bigint, precision = 4): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SHANNONS_PER_CKB;
  const fraction = absolute % SHANNONS_PER_CKB;
  const fractionText = fraction.toString().padStart(8, "0").slice(0, precision);
  return `${negative ? "-" : ""}${whole.toLocaleString()}${precision ? `.${fractionText}` : ""}`;
}

export function initialState(): SporeState {
  const wallets: Wallets = {
    issuer: ckb(12_000),
    collector: ckb(1_000),
  };
  return {
    phase: "empty",
    initialTotal: wallets.issuer + wallets.collector,
    wallets,
    feesPaid: 0n,
    nonce: 0,
    history: [],
  };
}

export function liveCapacity(state: SporeState): bigint {
  return state.cell && !state.cell.melted ? state.cell.capacity : 0n;
}

export function assertConservation(state: SporeState): void {
  const total = state.wallets.issuer + state.wallets.collector + liveCapacity(state) + state.feesPaid;
  if (total !== state.initialTotal) {
    throw new Error(`Capacity invariant failed: ${formatCkb(total)} != ${formatCkb(state.initialTotal)}.`);
  }
}

export function decodeStateDob(state: SporeState): DobObject | undefined {
  return state.cell ? decodeDob(state.cell.dna) : undefined;
}

export function createSpore(
  state: SporeState,
  input: { dna: string; backing: bigint; margin: bigint; contentType: string },
): SporeState {
  if (state.phase !== "empty") throw new Error("A live Spore already exists.");
  const dna = normalizeDna(input.dna);
  if (input.backing <= 0n) throw new Error("Backing capacity must be positive.");
  if (input.margin < TRANSFER_FEE * 2n) throw new Error("Capacity margin is too small for demo transfers.");
  const capacity = DEFAULT_OCCUPIED + input.backing + input.margin;
  if (state.wallets.issuer < capacity) throw new Error("Issuer wallet balance is too low.");

  const next: SporeState = {
    ...state,
    phase: "live",
    nonce: state.nonce + 1,
    wallets: {
      ...state.wallets,
      issuer: state.wallets.issuer - capacity,
    },
    cell: {
      id: `spore-${String(state.nonce + 1).padStart(4, "0")}`,
      owner: "issuer",
      capacity,
      occupiedCapacity: DEFAULT_OCCUPIED,
      capacityMargin: input.margin,
      dna,
      contentType: input.contentType,
      typeScript: "spore_type(args: spore-id)",
      clusterId: "ckbuilders-rich-object-lab",
      transfers: 0,
      melted: false,
    },
    history: [`Created Spore with ${formatCkb(capacity)} CKB capacity`, ...state.history],
  };
  assertConservation(next);
  return next;
}

export function transferSpore(state: SporeState, nextOwner: Owner): SporeState {
  if (state.phase !== "live" || !state.cell || state.cell.melted) {
    throw new Error("No live Spore cell is available to transfer.");
  }
  if (state.cell.owner === nextOwner) {
    throw new Error("The Spore is already owned by this lock.");
  }
  if (state.cell.capacityMargin < TRANSFER_FEE) {
    throw new Error("Capacity margin is exhausted.");
  }

  const nextCell: SporeCell = {
    ...state.cell,
    owner: nextOwner,
    capacity: state.cell.capacity - TRANSFER_FEE,
    capacityMargin: state.cell.capacityMargin - TRANSFER_FEE,
    transfers: state.cell.transfers + 1,
  };
  const next: SporeState = {
    ...state,
    cell: nextCell,
    feesPaid: state.feesPaid + TRANSFER_FEE,
    history: [`Transferred ${nextCell.id} to ${nextOwner}`, ...state.history],
  };
  assertConservation(next);
  return next;
}

export function meltSpore(state: SporeState): SporeState {
  if (state.phase !== "live" || !state.cell || state.cell.melted) {
    throw new Error("No live Spore cell is available to melt.");
  }
  if (state.cell.capacity <= MELT_FEE) throw new Error("Spore capacity cannot cover melt fee.");
  const owner = state.cell.owner;
  const redeemed = state.cell.capacity - MELT_FEE;
  const next: SporeState = {
    ...state,
    phase: "melted",
    wallets: {
      ...state.wallets,
      [owner]: state.wallets[owner] + redeemed,
    },
    feesPaid: state.feesPaid + MELT_FEE,
    cell: {
      ...state.cell,
      capacity: 0n,
      capacityMargin: 0n,
      melted: true,
    },
    history: [`Melted ${state.cell.id}; redeemed ${formatCkb(redeemed)} CKB`, ...state.history],
  };
  assertConservation(next);
  return next;
}

export function anatomyFor(state: SporeState, action: "create" | "transfer" | "melt"): TxAnatomy {
  if (action === "create") {
    return {
      title: "Create Spore",
      inputs: ["issuer capacity cells"],
      outputs: ["new Spore cell", "issuer change cell"],
      cellDeps: ["spore type script", "secp256k1 lock script"],
      witnesses: ["issuer lock witness"],
    };
  }
  if (action === "transfer") {
    return {
      title: "Transfer Spore",
      inputs: [state.cell ? `${state.cell.id} owned by ${state.cell.owner}` : "live Spore cell"],
      outputs: ["same Spore id under recipient lock", "optional change"],
      cellDeps: ["spore type script", "owner lock script"],
      witnesses: ["current owner signature"],
    };
  }
  return {
    title: "Melt Spore",
    inputs: [state.cell ? `${state.cell.id} owned by ${state.cell.owner}` : "live Spore cell"],
    outputs: ["ordinary owner CKB cell"],
    cellDeps: ["spore type script", "owner lock script"],
    witnesses: ["current owner signature", "melt intent"],
  };
}
