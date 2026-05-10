import fs from "fs";
import path from "path";

const hashLockPath = path.join(
  "d:/CKB/Test/simple-lock",
  "frontend",
  "app",
  "hash-lock.ts",
);

function idxOf(content, token) {
  const idx = content.indexOf(token);
  if (idx < 0) throw new Error(`Token not found: ${token}`);
  return idx;
}

function main() {
  const content = fs.readFileSync(hashLockPath, "utf8");

  const iTxCreate = idxOf(content, "ccc.Transaction.from({");
  const iSetOutput = idxOf(content, "output.capacity = ccc.fixedPointFrom(amountInCKB);");
  const iInputs = idxOf(content, "await tx.completeInputsByCapacity(");
  const iBalanceDiff = idxOf(content, "const balanceDiff =");
  const iWitness = idxOf(content, "tx.setWitnessArgsAt(0, newWitnessArgs);");
  const iSend = idxOf(content, "const txHash = await cccClient.sendTransaction(tx);");

  const orderingOk =
    iTxCreate < iSetOutput &&
    iSetOutput < iInputs &&
    iInputs < iBalanceDiff &&
    iBalanceDiff < iWitness &&
    iWitness < iSend;

  console.log("=== Transaction lifecycle proof ===");
  console.log("create tx                :", iTxCreate);
  console.log("set outputs              :", iSetOutput);
  console.log("complete inputs          :", iInputs);
  console.log("compute balance/fee diff :", iBalanceDiff);
  console.log("set witness              :", iWitness);
  console.log("send transaction         :", iSend);
  console.log("ordered flow ok          :", orderingOk ? "YES" : "NO");

  if (!orderingOk) {
    throw new Error("Lifecycle ordering broken in hash-lock.ts");
  }

  const hasManualFee = content.includes("capacity: balanceDiff - BigInt(1000)");
  const hasCompleteFeeBy = content.includes("completeFeeBy(");
  console.log("fee strategy             :", hasManualFee ? "manual fee diff (1000 shannon)" : "other");
  console.log("uses completeFeeBy       :", hasCompleteFeeBy ? "YES" : "NO");
  console.log("PASS: implementation demonstrates explicit CCC lifecycle phases.");
}

try {
  main();
} catch (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
}
