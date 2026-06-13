import type { DaoPhase } from "./dao-model";

export type ProtocolGate = {
  title: string;
  symbol: string;
  detail: string;
  source: string;
  activeIn: DaoPhase[];
};

export const protocolGates: ProtocolGate[] = [
  {
    title: "Empty script args",
    symbol: "args.size == 0",
    detail: "Every DAO cell belongs to one type-script group.",
    source: "dao.c:557",
    activeIn: ["deposited", "withdrawing"],
  },
  {
    title: "Deposit marker",
    symbol: "data == 0x0000000000000000",
    detail: "Eight zero bytes distinguish a fresh deposit cell.",
    source: "dao.c:526",
    activeIn: ["deposited"],
  },
  {
    title: "Phase-one parity",
    symbol: "output[i].capacity == input[i].capacity",
    detail: "The withdrawing cell stays at the same index with unchanged capacity.",
    source: "dao.c:323",
    activeIn: ["withdrawing"],
  },
  {
    title: "Deposit provenance",
    symbol: "data == deposit_block_number_le",
    detail: "Phase one stores the original deposit block number in eight bytes.",
    source: "dao.c:330",
    activeIn: ["withdrawing"],
  },
  {
    title: "Absolute epoch lock",
    symbol: "since >> 56 == 0x20",
    detail: "Final withdrawal uses an absolute epoch since value.",
    source: "dao.c:257",
    activeIn: ["withdrawing"],
  },
  {
    title: "Capacity ceiling",
    symbol: "outputs <= true_inputs",
    detail: "Outputs cannot exceed normal inputs plus DAO compensation.",
    source: "dao.c:637",
    activeIn: ["deposited", "withdrawing"],
  },
];

export const phaseCopy: Record<
  DaoPhase,
  { label: string; title: string; description: string; data: string }
> = {
  wallet: {
    label: "Ready",
    title: "CKB in your wallet",
    description: "Choose an amount to create a live cell with the Nervos DAO type script.",
    data: "No DAO cell",
  },
  deposited: {
    label: "Accruing",
    title: "Deposit cell",
    description: "Compensation grows with the DAO accumulate-rate field in each block header.",
    data: "0x0000000000000000",
  },
  withdrawing: {
    label: "Cooling down",
    title: "Withdrawing cell",
    description: "Compensation is frozen. The cell waits for its absolute epoch checkpoint.",
    data: "deposit block number (u64 LE)",
  },
  withdrawn: {
    label: "Complete",
    title: "Capacity released",
    description: "Principal and compensation have returned to the wallet as ordinary CKB.",
    data: "DAO cell consumed",
  },
};
