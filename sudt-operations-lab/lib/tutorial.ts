import type { AccountId, LabState, Operation } from "./model";

export type TutorialStep = {
  title: string;
  eyebrow: string;
  description: string;
  operation: Operation;
  command: string;
  lesson: string;
};

const OWNER = "<owner-address>";
const ALICE = "<alice-address>";
const BOB = "<bob-address>";
const ALICE_ACP = "<alice-acp-address>";

export const tutorialSteps: TutorialStep[] = [
  {
    eyebrow: "Setup",
    title: "Open Alice's ACP cell",
    description: "Create an empty token cell that Alice can later receive into.",
    operation: { kind: "create-acp", holder: "alice" },
    command: `ckb-cli sudt new-empty-acp \\\n  --owner ${OWNER} \\\n  --to ${ALICE} \\\n  --cell-deps ./cell_deps.json`,
    lesson: "Anyone-Can-Pay lets another party add assets without requiring Alice to unlock the cell.",
  },
  {
    eyebrow: "Issue",
    title: "Mint 2,000 SUDT to a cheque",
    description: "The owner issues supply for Alice, but places it under a cheque lock.",
    operation: { kind: "issue-cheque", receiver: "alice", amount: 2000 },
    command: `ckb-cli sudt issue \\\n  --owner ${OWNER} \\\n  --udt-to ${ALICE}:2000 \\\n  --to-cheque-address \\\n  --cell-deps ./cell_deps.json`,
    lesson: "The sUDT type script controls minting. The cheque lock controls who may consume the cell and when.",
  },
  {
    eyebrow: "Claim",
    title: "Alice claims the cheque",
    description: "Alice unlocks the cheque and moves its token data into her ACP cell.",
    operation: { kind: "claim", sender: "owner", receiver: "alice" },
    command: `ckb-cli sudt cheque-claim \\\n  --owner ${OWNER} \\\n  --sender ${OWNER} \\\n  --receiver ${ALICE} \\\n  --cell-deps ./cell_deps.json`,
    lesson: "Claim consumes the cheque cell. Token supply does not change; only the lock script changes.",
  },
  {
    eyebrow: "Setup",
    title: "Open Bob's ACP cell",
    description: "Bob needs a compatible destination cell before a direct ACP transfer.",
    operation: { kind: "create-acp", holder: "bob" },
    command: `ckb-cli sudt new-empty-acp \\\n  --owner ${OWNER} \\\n  --to ${BOB} \\\n  --cell-deps ./cell_deps.json`,
    lesson: "The empty cell reserves CKB capacity and fixes both the ACP lock and SUDT type scripts.",
  },
  {
    eyebrow: "Transfer",
    title: "Alice sends Bob 600 SUDT",
    description: "A direct ACP transfer updates both live token cells in one transaction.",
    operation: { kind: "transfer-acp", sender: "alice", receiver: "bob", amount: 600 },
    command: `ckb-cli sudt transfer \\\n  --owner ${OWNER} \\\n  --sender ${ALICE_ACP} \\\n  --udt-to <bob-acp-address>:600 \\\n  --to-acp-address \\\n  --cell-deps ./cell_deps.json`,
    lesson: "Alice signs for her input. Bob's ACP output can accept the additional tokens without Bob signing.",
  },
  {
    eyebrow: "Issue",
    title: "Mint 300 more to Alice",
    description: "The owner can issue directly into Alice's existing ACP cell.",
    operation: { kind: "issue-acp", receiver: "alice", amount: 300 },
    command: `ckb-cli sudt issue \\\n  --owner ${OWNER} \\\n  --udt-to ${ALICE_ACP}:300 \\\n  --to-acp-address \\\n  --cell-deps ./cell_deps.json`,
    lesson: "This is the only step after initial issuance that increases total supply.",
  },
  {
    eyebrow: "Cheque",
    title: "Alice writes Bob a 500 SUDT cheque",
    description: "Tokens leave Alice's ACP cell and wait in a receiver-specific cheque.",
    operation: { kind: "transfer-cheque", sender: "alice", receiver: "bob", amount: 500 },
    command: `ckb-cli sudt transfer \\\n  --owner ${OWNER} \\\n  --sender ${ALICE_ACP} \\\n  --udt-to ${BOB}:500 \\\n  --to-cheque-address \\\n  --cell-deps ./cell_deps.json`,
    lesson: "A cheque can receive tokens without Bob pre-funding another cell's CKB capacity.",
  },
  {
    eyebrow: "Claim",
    title: "Bob claims Alice's cheque",
    description: "Bob moves the pending amount into his ACP cell.",
    operation: { kind: "claim", sender: "alice", receiver: "bob" },
    command: `ckb-cli sudt cheque-claim \\\n  --owner ${OWNER} \\\n  --sender ${ALICE} \\\n  --receiver ${BOB} \\\n  --cell-deps ./cell_deps.json`,
    lesson: "The receiver path is available immediately and proves control of Bob's lock.",
  },
  {
    eyebrow: "Cheque",
    title: "Write one cheque that will expire",
    description: "Alice sends another 500 SUDT, but Bob leaves it unclaimed.",
    operation: { kind: "transfer-cheque", sender: "alice", receiver: "bob", amount: 500 },
    command: `ckb-cli sudt transfer \\\n  --owner ${OWNER} \\\n  --sender ${ALICE_ACP} \\\n  --udt-to ${BOB}:500 \\\n  --to-cheque-address \\\n  --cell-deps ./cell_deps.json`,
    lesson: "Until claim or refund, the amount remains live supply held by the cheque cell.",
  },
  {
    eyebrow: "Time",
    title: "Advance six epochs",
    description: "The cheque's sender path becomes valid after the relative timelock.",
    operation: { kind: "mine", epochs: 6 },
    command: `# Historical dev-chain shortcut from the tutorial\nckb miner -l 10800`,
    lesson: "The original tutorial approximates six epochs as 10,800 blocks. Epochs are the protocol-level rule.",
  },
  {
    eyebrow: "Refund",
    title: "Alice withdraws the expired cheque",
    description: "Alice recovers the unclaimed 500 SUDT into her ACP cell.",
    operation: { kind: "withdraw", sender: "alice", receiver: "bob" },
    command: `ckb-cli sudt cheque-withdraw \\\n  --owner ${OWNER} \\\n  --sender ${ALICE} \\\n  --receiver ${BOB} \\\n  --to-acp-address \\\n  --cell-deps ./cell_deps.json`,
    lesson: "The timeout protects the sender from funds remaining locked forever.",
  },
];

export const accountName = (account: AccountId) =>
  account === "owner" ? "Issuer" : account === "alice" ? "Alice" : "Bob";

export function cliAddress(account: AccountId): string {
  return account === "owner" ? OWNER : account === "alice" ? ALICE : BOB;
}

export function stateSummary(state: LabState): string {
  const cheques = state.cells.filter((cell) => cell.kind === "cheque").length;
  return `${state.cells.length} live cells, ${cheques} pending cheque${cheques === 1 ? "" : "s"}`;
}
