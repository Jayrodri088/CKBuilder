export type AccountId = "owner" | "alice" | "bob";
export type CellKind = "acp" | "cheque";

export type TokenCell = {
  id: string;
  kind: CellKind;
  amount: number;
  holder?: AccountId;
  sender?: AccountId;
  receiver?: AccountId;
  createdEpoch: number;
};

export type LabState = {
  epoch: number;
  issued: number;
  nonce: number;
  cells: TokenCell[];
};

export type Operation =
  | { kind: "create-acp"; holder: AccountId }
  | { kind: "issue-cheque"; receiver: AccountId; amount: number }
  | { kind: "issue-acp"; receiver: AccountId; amount: number }
  | { kind: "transfer-acp"; sender: AccountId; receiver: AccountId; amount: number }
  | { kind: "transfer-cheque"; sender: AccountId; receiver: AccountId; amount: number }
  | { kind: "claim"; sender: AccountId; receiver: AccountId }
  | { kind: "withdraw"; sender: AccountId; receiver: AccountId }
  | { kind: "mine"; epochs: number };

export const WITHDRAW_EPOCHS = 6;

export const initialState = (): LabState => ({
  epoch: 0,
  issued: 0,
  nonce: 0,
  cells: [],
});

const assertAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive whole number.");
  }
};

const newCell = (
  state: LabState,
  cell: Omit<TokenCell, "id" | "createdEpoch">,
): TokenCell => ({
  ...cell,
  id: `cell-${state.nonce + 1}`,
  createdEpoch: state.epoch,
});

const findAcp = (state: LabState, holder: AccountId) =>
  state.cells.find((cell) => cell.kind === "acp" && cell.holder === holder);

const requireAcp = (state: LabState, holder: AccountId) => {
  const cell = findAcp(state, holder);
  if (!cell) throw new Error(`${holder} needs an ACP cell first.`);
  return cell;
};

const updateCell = (state: LabState, id: string, amount: number): LabState => ({
  ...state,
  cells: state.cells.map((cell) => (cell.id === id ? { ...cell, amount } : cell)),
});

const removeCells = (state: LabState, ids: string[]): LabState => ({
  ...state,
  cells: state.cells.filter((cell) => !ids.includes(cell.id)),
});

export function balanceOf(state: LabState, holder: AccountId): number {
  return state.cells
    .filter((cell) => cell.kind === "acp" && cell.holder === holder)
    .reduce((total, cell) => total + cell.amount, 0);
}

export function pendingFor(state: LabState, receiver: AccountId): number {
  return state.cells
    .filter((cell) => cell.kind === "cheque" && cell.receiver === receiver)
    .reduce((total, cell) => total + cell.amount, 0);
}

export function totalInCells(state: LabState): number {
  return state.cells.reduce((total, cell) => total + cell.amount, 0);
}

export function assertConservation(state: LabState): void {
  if (totalInCells(state) !== state.issued) {
    throw new Error(`Supply invariant failed: issued ${state.issued}, cells ${totalInCells(state)}.`);
  }
}

export function applyOperation(state: LabState, operation: Operation): LabState {
  let next: LabState;

  switch (operation.kind) {
    case "create-acp": {
      if (findAcp(state, operation.holder)) {
        throw new Error(`${operation.holder} already has an ACP cell.`);
      }
      next = {
        ...state,
        nonce: state.nonce + 1,
        cells: [
          ...state.cells,
          newCell(state, { kind: "acp", holder: operation.holder, amount: 0 }),
        ],
      };
      break;
    }
    case "issue-cheque": {
      assertAmount(operation.amount);
      const cell = newCell(state, {
        kind: "cheque",
        sender: "owner",
        receiver: operation.receiver,
        amount: operation.amount,
      });
      next = {
        ...state,
        issued: state.issued + operation.amount,
        nonce: state.nonce + 1,
        cells: [...state.cells, cell],
      };
      break;
    }
    case "issue-acp": {
      assertAmount(operation.amount);
      const receiver = requireAcp(state, operation.receiver);
      next = updateCell(state, receiver.id, receiver.amount + operation.amount);
      next = { ...next, issued: state.issued + operation.amount };
      break;
    }
    case "transfer-acp": {
      assertAmount(operation.amount);
      const sender = requireAcp(state, operation.sender);
      const receiver = requireAcp(state, operation.receiver);
      if (sender.amount < operation.amount) throw new Error("Sender balance is too low.");
      next = updateCell(state, sender.id, sender.amount - operation.amount);
      next = updateCell(next, receiver.id, receiver.amount + operation.amount);
      break;
    }
    case "transfer-cheque": {
      assertAmount(operation.amount);
      const sender = requireAcp(state, operation.sender);
      if (sender.amount < operation.amount) throw new Error("Sender balance is too low.");
      next = updateCell(state, sender.id, sender.amount - operation.amount);
      const cheque = newCell(next, {
        kind: "cheque",
        sender: operation.sender,
        receiver: operation.receiver,
        amount: operation.amount,
      });
      next = {
        ...next,
        nonce: next.nonce + 1,
        cells: [...next.cells, cheque],
      };
      break;
    }
    case "claim": {
      const receiver = requireAcp(state, operation.receiver);
      const cheques = state.cells.filter(
        (cell) =>
          cell.kind === "cheque" &&
          cell.sender === operation.sender &&
          cell.receiver === operation.receiver,
      );
      if (cheques.length === 0) throw new Error("No matching cheque is available to claim.");
      const amount = cheques.reduce((total, cell) => total + cell.amount, 0);
      next = removeCells(state, cheques.map((cell) => cell.id));
      next = updateCell(next, receiver.id, receiver.amount + amount);
      break;
    }
    case "withdraw": {
      const sender = requireAcp(state, operation.sender);
      const cheques = state.cells.filter(
        (cell) =>
          cell.kind === "cheque" &&
          cell.sender === operation.sender &&
          cell.receiver === operation.receiver &&
          state.epoch - cell.createdEpoch >= WITHDRAW_EPOCHS,
      );
      if (cheques.length === 0) {
        throw new Error(`No refundable cheque has reached ${WITHDRAW_EPOCHS} epochs.`);
      }
      const amount = cheques.reduce((total, cell) => total + cell.amount, 0);
      next = removeCells(state, cheques.map((cell) => cell.id));
      next = updateCell(next, sender.id, sender.amount + amount);
      break;
    }
    case "mine":
      assertAmount(operation.epochs);
      next = { ...state, epoch: state.epoch + operation.epochs };
      break;
  }

  assertConservation(next);
  return next;
}
