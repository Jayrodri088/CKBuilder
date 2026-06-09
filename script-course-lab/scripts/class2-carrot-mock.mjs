import fs, { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { hexFrom, Transaction, hashTypeToBytes, Script } from "@ckb-ccc/core";
import { ensureDebuggerOnPath } from "../lib/debugger.mjs";

ensureDebuggerOnPath();

const require = createRequire(import.meta.url);
const {
  Resource,
  Verifier,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
  DEFAULT_SCRIPT_CKB_JS_VM,
} = require("ckb-testtool");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const carrotBc = path.join(root, "dist", "carrot.bc");

function dataHex(text) {
  return hexFrom(Array.from(text).map((c) => c.charCodeAt(0)));
}

function runCase(label, outputDataText, shouldSucceed) {
  const resource = Resource.default();
  const tx = Transaction.default();

  const vmLoader = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)),
    tx,
    false,
  );
  const alwaysSuccess = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false,
  );
  const carrotCode = resource.deployCell(hexFrom(readFileSync(carrotBc)), tx, false);

  const carrotType = Script.from({
    codeHash: vmLoader.codeHash,
    hashType: vmLoader.hashType,
    args: hexFrom(
      "0x0000" +
        carrotCode.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(carrotCode.hashType)).slice(2),
    ),
  });

  const inputCell = resource.mockCell(alwaysSuccess, undefined, "0x");
  tx.inputs.push(Resource.createCellInput(inputCell));

  tx.outputs.push(Resource.createCellOutput(alwaysSuccess, carrotType));
  tx.outputsData.push(dataHex(outputDataText));

  const verifier = Verifier.from(resource, tx);
  if (shouldSucceed) {
    verifier.verifySuccess(true);
    console.log(`  OK: "${outputDataText}" → validation success`);
  } else {
    let failed = false;
    try {
      verifier.verifySuccess(true);
    } catch {
      failed = true;
    }
    if (!failed) throw new Error(`expected failure for data starting with carrot`);
    console.log(`  OK: "${outputDataText}" → validation rejected (expected)`);
  }
}

console.log("=== Class 2: Script Basics — carrot mock ===");
console.log("Reference: https://docs.nervos.org/docs/script-course/intro-to-script-2\n");

if (!fs.existsSync(carrotBc)) {
  console.error("FAIL: dist/carrot.bc missing — run: pnpm run build:carrot");
  process.exit(1);
}

console.log("Script vs script code:");
console.log("  script code  → dist/carrot.bc (RISC-V binary in mock cell data)");
console.log("  script       → { codeHash, hashType, args } on output.type");
console.log("  cell dep     → mock world resolves code cell automatically\n");

console.log("Deploy steps (Class 2 recipe):");
console.log("  1. Compile carrot to bytecode");
console.log("  2. Store binary in a cell's data");
console.log("  3. Point type script codeHash at that data hash");
console.log("  4. Attach type script to output + add cell dep");
console.log("  5. Send tx — type script runs on validation\n");

console.log("Verification:");
runCase("safe payload", "potato salad", true);
runCase("forbidden prefix", "carrot soup", false);

console.log("\nPASS: carrot type script behaves like script course Class 2.");
