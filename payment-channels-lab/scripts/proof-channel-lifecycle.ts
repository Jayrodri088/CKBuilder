import {
  FIBER_CHANNEL_STATES,
  assertTransition,
  canTransition,
} from "../lib/channel-model.js";

function main() {
  console.log("=== Fiber channel state machine proof ===\n");
  console.log("States:", FIBER_CHANNEL_STATES.join(" -> "));

  const happyPath: typeof FIBER_CHANNEL_STATES[number][] = [
    "Negotiating",
    "Collaborating",
    "AwaitingTxSignatures",
    "AwaitingChannelReady",
    "ChannelReady",
    "ShuttingDown",
    "Closed",
  ];

  for (let i = 0; i < happyPath.length - 1; i++) {
    const from = happyPath[i];
    const to = happyPath[i + 1];
    assertTransition(from, to);
    console.log(`  OK ${from} -> ${to}`);
  }

  const illegal = canTransition("Closed", "ChannelReady");
  if (illegal) throw new Error("Closed -> ChannelReady should be illegal");
  console.log("  OK Closed -> ChannelReady blocked");

  console.log("\nPASS: lifecycle matches Fiber open/pay/close documentation.");
}

main();
