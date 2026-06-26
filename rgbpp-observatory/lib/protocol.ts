export const flowSteps = [
  {
    title: "Off-chain pre-computation",
    detail: "Build the CKB state transition and hash it together with current and next Bitcoin UTXOs.",
  },
  {
    title: "Bitcoin transaction",
    detail: "Spend the old UTXO seal, create a new UTXO, and include the CKB commitment in OP_RETURN.",
  },
  {
    title: "CKB transaction",
    detail: "Submit the RGB++ state transition with Bitcoin transaction data as witness material.",
  },
  {
    title: "On-chain verification",
    detail: "RGB++ scripts validate seal consumption, OP_RETURN commitment, SPV proof, and CKB state rules.",
  },
];

export const deploymentFacts = [
  {
    network: "Meepo Mainnet",
    script: "RGB++ Script",
    codeHash: "0xbc6c568a1a0d0a09f6844dc9d74ddb4343c32143ff25f727c59edf4fb72d6936",
  },
  {
    network: "Meepo Testnet / Bitcoin Testnet3",
    script: "RGB++ Script",
    codeHash: "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
  },
  {
    network: "Meepo Testnet / Bitcoin Signet",
    script: "RGB++ Script",
    codeHash: "0xd07598deec7ce7b5665310386b4abd06a6d48843e953c5cc2112ad0d5a220364",
  },
];
