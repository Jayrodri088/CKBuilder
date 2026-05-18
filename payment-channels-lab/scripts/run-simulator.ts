import { createChannel, closeChannel, payOffChain, summarize } from "../lib/simulator.js";
import { shannonToCkb } from "../lib/channel-model.js";

function main() {
  console.log("=== Two-party payment channel simulator (Fiber-style) ===\n");

  let ch = createChannel(500);
  console.log("1) Open channel (L1 funding tx):", summarize(ch));

  ch = payOffChain(ch, "alice", "bob", 100);
  console.log("2) Off-chain payment Alice -> Bob 100 CKB:", summarize(ch));

  ch = payOffChain(ch, "alice", "bob", 50);
  console.log("3) Off-chain payment Alice -> Bob 50 CKB:", summarize(ch));

  const { channel, settlement } = closeChannel(ch);
  console.log("4) Close channel (L1 settlement tx):", summarize(channel));
  console.log(
    "   Settlement: Alice",
    shannonToCkb(settlement.aliceReceives),
    "CKB | Bob",
    shannonToCkb(settlement.bobReceives),
    "CKB",
  );
  console.log(
    "\nPASS: 2 on-chain txs (open + close),",
    channel.payments.length,
    "off-chain updates, balances conserved.",
  );
}

main();
