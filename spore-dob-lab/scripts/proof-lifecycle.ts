import assert from "node:assert/strict";
import {
  assertConservation,
  ckb,
  createSpore,
  formatCkb,
  initialState,
  meltSpore,
  transferSpore,
} from "../lib/spore-model";
import { decodeDob } from "../lib/dob";
import { callSsriMethod, demoMethodPath } from "../lib/ssri";

const dna = "0x7ac19e455601ff0088aabbccddeeff00";
let state = initialState();

state = createSpore(state, {
  dna,
  backing: ckb(500),
  margin: ckb(1),
  contentType: "application/dob+json",
});
assert.equal(state.phase, "live");
assert.equal(state.cell?.owner, "issuer");
assert.equal(state.cell?.id, "spore-0001");
assertConservation(state);

const decoded = decodeDob(state.cell!.dna);
assert.equal(decoded.dna, dna);
assert.equal(decoded.pattern, "dob/1:ckbuilder-observatory");
assert(decoded.traits.length >= 6);

state = transferSpore(state, "collector");
assert.equal(state.cell?.owner, "collector");
assert.equal(state.cell?.id, "spore-0001");
assertConservation(state);

state = meltSpore(state);
assert.equal(state.phase, "melted");
assert.equal(state.cell?.melted, true);
assertConservation(state);

const methodPath = demoMethodPath("Spore.version");
const method = callSsriMethod(methodPath);
assert.equal(method.signature, "Spore.version");

console.log("Spore/DOB/SSRI lifecycle proof passed.");
console.log(`Final collector wallet: ${formatCkb(state.wallets.collector)} CKB`);
console.log(`SSRI demo method path: ${methodPath}`);
