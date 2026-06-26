export type Owner = "alice" | "bob" | "amm";
export type Phase = "issued" | "btc_submitted" | "ckb_submitted" | "verified";

export type BitcoinUtxo = {
  id: string;
  owner: Owner;
  sats: number;
  spent: boolean;
};

export type RgbppCell = {
  id: string;
  ownerSeal: string;
  owner: Owner;
  assetType: "xUDT";
  amount: number;
  data: string;
};

export type BtcTx = {
  id: string;
  inputSeal: string;
  outputSeal: string;
  opReturn: string;
  blockHeight: number;
  merkleProof: string;
};

export type CkbTx = {
  id: string;
  inputCell: string;
  outputCell: string;
  inputSeal: string;
  outputSeal: string;
  commitment: string;
  witnessBtcTx: string;
};

export type RgbppState = {
  phase: Phase;
  utxos: BitcoinUtxo[];
  cells: RgbppCell[];
  btcTxs: BtcTx[];
  ckbTxs: CkbTx[];
  nonce: number;
  history: string[];
};

export type ValidationGate = {
  title: string;
  status: "pass" | "pending" | "fail";
  detail: string;
};

const hash = (input: string) => {
  let value = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const char of input) {
    value ^= BigInt(char.codePointAt(0) ?? 0);
    value = BigInt.asUintN(64, value * prime);
  }
  return `0x${value.toString(16).padStart(16, "0")}`;
};

export function commitmentFor(input: {
  ckbTxId: string;
  inputSeal: string;
  outputSeal: string;
  amount: number;
  data: string;
}): string {
  return hash(JSON.stringify(input));
}

export function initialState(): RgbppState {
  const genesisSeal: BitcoinUtxo = {
    id: "btc-utxo-a1:0",
    owner: "alice",
    sats: 10_000,
    spent: false,
  };
  return {
    phase: "issued",
    nonce: 1,
    utxos: [
      genesisSeal,
      { id: "btc-utxo-b1:0", owner: "bob", sats: 8_000, spent: false },
      { id: "btc-utxo-pool:0", owner: "amm", sats: 12_000, spent: false },
    ],
    cells: [
      {
        id: "ckb-cell-rgb-0001",
        ownerSeal: genesisSeal.id,
        owner: "alice",
        assetType: "xUDT",
        amount: 1_000,
        data: "rgbpp:xudt:1000",
      },
    ],
    btcTxs: [],
    ckbTxs: [],
    history: ["Issued 1,000 RGB++ xUDT bound to Alice's Bitcoin UTXO"],
  };
}

export function activeCell(state: RgbppState): RgbppCell {
  const cell = state.cells[state.cells.length - 1];
  if (!cell) throw new Error("No active RGB++ cell.");
  return cell;
}

export function activeSeal(state: RgbppState): BitcoinUtxo {
  const cell = activeCell(state);
  const utxo = state.utxos.find((item) => item.id === cell.ownerSeal);
  if (!utxo) throw new Error(`Missing bound Bitcoin UTXO: ${cell.ownerSeal}`);
  return utxo;
}

export function prepareTransfer(state: RgbppState, nextOwner: Owner): RgbppState {
  const cell = activeCell(state);
  const inputSeal = activeSeal(state);
  if (inputSeal.spent) throw new Error("The current single-use seal has already been consumed.");
  if (cell.owner === nextOwner) throw new Error("The next owner must differ from the current owner.");

  const nonce = state.nonce + 1;
  const outputSeal: BitcoinUtxo = {
    id: `btc-utxo-${nextOwner}-${nonce}:0`,
    owner: nextOwner,
    sats: inputSeal.sats - 250,
    spent: false,
  };
  const outputCell: RgbppCell = {
    id: `ckb-cell-rgb-${String(nonce).padStart(4, "0")}`,
    ownerSeal: outputSeal.id,
    owner: nextOwner,
    assetType: cell.assetType,
    amount: cell.amount,
    data: `rgbpp:xudt:${cell.amount}`,
  };
  const ckbTxId = `ckb-tx-${String(nonce).padStart(4, "0")}`;
  const commitment = commitmentFor({
    ckbTxId,
    inputSeal: inputSeal.id,
    outputSeal: outputSeal.id,
    amount: outputCell.amount,
    data: outputCell.data,
  });
  const btcTx: BtcTx = {
    id: `btc-tx-${String(nonce).padStart(4, "0")}`,
    inputSeal: inputSeal.id,
    outputSeal: outputSeal.id,
    opReturn: commitment,
    blockHeight: 840_000 + nonce,
    merkleProof: hash(`merkle:${nonce}:${commitment}`).slice(0, 18),
  };
  const ckbTx: CkbTx = {
    id: ckbTxId,
    inputCell: cell.id,
    outputCell: outputCell.id,
    inputSeal: inputSeal.id,
    outputSeal: outputSeal.id,
    commitment,
    witnessBtcTx: btcTx.id,
  };

  return {
    ...state,
    phase: "btc_submitted",
    nonce,
    utxos: state.utxos.map((utxo) =>
      utxo.id === inputSeal.id ? { ...utxo, spent: true } : utxo,
    ).concat(outputSeal),
    btcTxs: [...state.btcTxs, btcTx],
    ckbTxs: [...state.ckbTxs, ckbTx],
    history: [`Prepared paired RGB++ transfer from ${cell.owner} to ${nextOwner}`, ...state.history],
  };
}

export function submitCkbTransaction(state: RgbppState): RgbppState {
  if (state.phase !== "btc_submitted") {
    throw new Error("Submit the Bitcoin commitment transaction first.");
  }
  const ckbTx = state.ckbTxs[state.ckbTxs.length - 1];
  const previous = state.cells.find((cell) => cell.id === ckbTx.inputCell);
  if (!previous) throw new Error("Missing RGB++ input cell.");
  const outputUtxo = state.utxos.find((utxo) => utxo.id === ckbTx.outputSeal);
  if (!outputUtxo) throw new Error("Missing output seal.");
  const output: RgbppCell = {
    id: ckbTx.outputCell,
    ownerSeal: ckbTx.outputSeal,
    owner: outputUtxo.owner,
    assetType: previous.assetType,
    amount: previous.amount,
    data: previous.data,
  };
  return {
    ...state,
    phase: "ckb_submitted",
    cells: [...state.cells, output],
    history: [`Submitted CKB state transition bound to ${ckbTx.outputSeal}`, ...state.history],
  };
}

export function validateLatest(state: RgbppState): ValidationGate[] {
  const ckbTx = state.ckbTxs[state.ckbTxs.length - 1];
  const btcTx = state.btcTxs[state.btcTxs.length - 1];
  const cell = activeCell(state);
  if (!ckbTx || !btcTx) {
    return [
      { title: "Single-use seal", status: "pending", detail: "No transfer transaction yet." },
      { title: "OP_RETURN commitment", status: "pending", detail: "No Bitcoin commitment yet." },
      { title: "SPV proof", status: "pending", detail: "No Bitcoin transaction witness yet." },
      { title: "Isomorphic binding", status: "pending", detail: "No new CKB cell yet." },
    ];
  }
  const expectedCommitment = commitmentFor({
    ckbTxId: ckbTx.id,
    inputSeal: ckbTx.inputSeal,
    outputSeal: ckbTx.outputSeal,
    amount: cell.amount,
    data: cell.data,
  });
  const spentInput = state.utxos.find((utxo) => utxo.id === ckbTx.inputSeal)?.spent === true;
  const outputSeal = state.utxos.find((utxo) => utxo.id === ckbTx.outputSeal);

  return [
    {
      title: "Single-use seal",
      status: spentInput ? "pass" : "fail",
      detail: `${ckbTx.inputSeal} must be consumed exactly once by Bitcoin.`,
    },
    {
      title: "OP_RETURN commitment",
      status: btcTx.opReturn === expectedCommitment ? "pass" : "fail",
      detail: "Bitcoin OP_RETURN must commit to the CKB state transition and seal rotation.",
    },
    {
      title: "SPV proof",
      status: btcTx.merkleProof.startsWith("0x") && btcTx.blockHeight > 0 ? "pass" : "fail",
      detail: "CKB script receives Bitcoin tx proof through SPV/light-client data.",
    },
    {
      title: "Isomorphic binding",
      status: outputSeal && cell.ownerSeal === outputSeal.id && cell.owner === outputSeal.owner ? "pass" : "fail",
      detail: "The new CKB cell must be bound one-to-one to the new Bitcoin UTXO.",
    },
  ];
}

export function finalizeVerification(state: RgbppState): RgbppState {
  if (state.phase !== "ckb_submitted") throw new Error("Submit the CKB transaction before verification.");
  const gates = validateLatest(state);
  const failed = gates.find((gate) => gate.status !== "pass");
  if (failed) throw new Error(`Validation gate failed: ${failed.title}`);
  return {
    ...state,
    phase: "verified",
    history: ["Verified RGB++ ownership transfer on CKB", ...state.history],
  };
}

export function transferCycle(state: RgbppState, nextOwner: Owner): RgbppState {
  return finalizeVerification(submitCkbTransaction(prepareTransfer(state, nextOwner)));
}

export function assertRgbppInvariants(state: RgbppState): void {
  const active = activeCell(state);
  const bound = state.utxos.find((utxo) => utxo.id === active.ownerSeal);
  if (!bound) throw new Error("Active CKB cell is not bound to a Bitcoin UTXO.");
  if (bound.owner !== active.owner) throw new Error("Owner mismatch between UTXO and CKB cell.");
  const total = state.cells[state.cells.length - 1]?.amount;
  if (total !== 1_000) throw new Error("RGB++ xUDT amount invariant failed.");
}
