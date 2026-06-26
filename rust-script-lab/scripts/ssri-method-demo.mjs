import { createHash } from "node:crypto";
import assert from "node:assert/strict";

function methodPath(signature) {
  // Demo approximation: SSRI uses the first 8 bytes of a CKB-hash-derived
  // method signature. Node does not expose CKB's exact personalization here, so
  // this keeps the dispatch shape concrete without claiming production hashes.
  return `0x${createHash("blake2b512").update(signature).digest("hex").slice(0, 16)}`;
}

const methods = [
  {
    signature: "SSRI.version",
    response: "rust-script-lab/ssri-demo/0.1.0",
  },
  {
    signature: "SSRI.supported_methods",
    response: "SSRI.version, SSRI.supported_methods, Spore.cell_deps, DOB.decode",
  },
  {
    signature: "Spore.cell_deps",
    response: "spore_type, cluster_type, dob_decoder",
  },
  {
    signature: "DOB.decode",
    response: "returns decoded traits for DOB DNA bytes",
  },
].map((method) => ({
  ...method,
  path: methodPath(method.signature),
}));

function dispatch(path) {
  const method = methods.find((candidate) => candidate.path === path);
  if (!method) {
    throw new Error(`Unknown SSRI method path: ${path}`);
  }
  return method;
}

for (const method of methods) {
  assert.equal(dispatch(method.path).signature, method.signature);
}

console.log("SSRI method dispatch demo passed.");
for (const method of methods) {
  console.log(`${method.path} ${method.signature} -> ${method.response}`);
}
