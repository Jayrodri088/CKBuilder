import { planValidation, formatPlan } from "../lib/validation-model.mjs";

console.log("=== Class 1: Validation Model ===");
console.log("Reference: https://docs.nervos.org/docs/script-course/intro-to-script-1\n");

console.log("Rules:");
console.log("  • Every cell has a lock script; spending requires input lock success.");
console.log("  • Type scripts (optional) validate transformation rules.");
console.log("  • Unique lock scripts on inputs run once each (deduped).");
console.log("  • Unique type scripts on inputs+outputs run once each (deduped).");
console.log("  • Output lock scripts are NOT executed when cells are created.");
console.log("  • Any script non-zero exit → whole transaction fails.\n");

const hashLockSpend = {
  inputs: [
    {
      lock: { codeHash: "0xaaa", hashType: "type", args: "0xhash" },
      type: null,
    },
  ],
  outputs: [
    {
      lock: { codeHash: "0xbbb", hashType: "type", args: "0xrecv" },
      type: null,
    },
    {
      lock: { codeHash: "0xaaa", hashType: "type", args: "0xchange" },
      type: null,
    },
  ],
};

const plan1 = planValidation(hashLockSpend);
console.log("Example A — hash-lock claim (like Pay Link):");
console.log(formatPlan(plan1));
if (plan1.lockScriptsToRun.length !== 1) throw new Error("expected one input lock run");
if (plan1.typeScriptsToRun.length !== 0) throw new Error("expected no type scripts");
if (plan1.outputLocksNotExecuted.length !== 2) throw new Error("expected two output locks skipped");

const carrotMint = {
  inputs: [
    {
      lock: { codeHash: "0xsecp", hashType: "type", args: "0x1" },
      type: null,
    },
  ],
  outputs: [
    {
      lock: { codeHash: "0xsecp", hashType: "type", args: "0x2" },
      type: { codeHash: "0xcarrot", hashType: "data2", args: "0x" },
    },
  ],
};

const plan2 = planValidation(carrotMint);
console.log("\nExample B — attach carrot type script to new output:");
console.log(formatPlan(plan2));
if (plan2.typeScriptsToRun.length !== 1) throw new Error("expected carrot type run");
if (plan2.typeScriptsToRun[0].where !== "output") throw new Error("carrot runs on output type");

const dedupe = {
  inputs: [
    { lock: { codeHash: "0xL", hashType: "type", args: "0xa" }, type: null },
    { lock: { codeHash: "0xL", hashType: "type", args: "0xa" }, type: null },
  ],
  outputs: [{ lock: { codeHash: "0xR", hashType: "type", args: "0x" }, type: null }],
};

const plan3 = planValidation(dedupe);
console.log("\nExample C — two inputs, same lock (deduped):");
console.log(formatPlan(plan3));
if (plan3.lockScriptsToRun.length !== 1) throw new Error("duplicate input locks should dedupe");

console.log("\nPASS: Class 1 validation model demonstrated on tx fixtures.");
