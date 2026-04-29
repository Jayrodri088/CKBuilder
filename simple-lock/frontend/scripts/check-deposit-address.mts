/**
 * Compare tutorial/docs deposit address vs this app's derived address (default preimage).
 * Run from repo: pnpm --filter frontend exec tsx scripts/check-deposit-address.mts
 */
process.env.NEXT_PUBLIC_NETWORK ??= "devnet";

const DEPOSITED =
  "ckt1qp02fww4qzf6rx2rm3ugc9dmma7dnky7l4ne3xsck930aj5pfkgtkqgqqpdsmqftz49xmjqgm2yr0ejj5jpsgw9w6vtazlaukdf9xecu4z32kqgsdyg7f7p70y8pavhnn00ly0qaksldttujr8mk8et38zd0yyjeegxctl4m";

async function main() {
  const { hashCkb, hexFrom } = await import("@ckb-ccc/core");
  const { generateAccount, capacityOf } = await import("../app/hash-lock.js");

  const preimage = "Hello World";
  const buffer = hexFrom(Array.from(preimage).map((c) => c.charCodeAt(0)));
  const hashHex = hashCkb(buffer).slice(2);
  const { address: appAddress } = generateAccount(hashHex);

  console.log("Network:", process.env.NEXT_PUBLIC_NETWORK);
  console.log("Default preimage:", JSON.stringify(preimage));
  console.log("Lock hash (hex, no 0x):", hashHex);
  console.log("");
  console.log("Address you deposited to (docs example):");
  console.log(DEPOSITED);
  console.log("");
  console.log("Address this app derives (same preimage + local scripts.json):");
  console.log(appAddress);
  console.log("");
  console.log("Match:", appAddress === DEPOSITED ? "YES — funds show in UI." : "NO — deposit went to a different lock.");

  try {
    const [depShannon, appShannon] = await Promise.all([
      capacityOf(DEPOSITED),
      capacityOf(appAddress),
    ]);
    console.log("");
    console.log("Live devnet capacity (shannon) if RPC is up:");
    console.log("  docs address:", depShannon.toString());
    console.log("  app address: ", appShannon.toString());
  } catch (e) {
    console.log("");
    console.log(
      "Could not query RPC (start offckb / check port 28114):",
      e instanceof Error ? e.message : e,
    );
  }
}

main().catch(console.error);
