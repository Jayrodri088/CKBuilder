import assert from "node:assert/strict";
import {
  applyOperation,
  assertConservation,
  balanceOf,
  initialState,
  pendingFor,
} from "../lib/model";
import { tutorialSteps } from "../lib/tutorial";

let state = initialState();

for (const step of tutorialSteps) {
  state = applyOperation(state, step.operation);
  assertConservation(state);
}

assert.equal(state.issued, 2300);
assert.equal(balanceOf(state, "alice"), 1200);
assert.equal(balanceOf(state, "bob"), 1100);
assert.equal(pendingFor(state, "bob"), 0);
assert.equal(state.epoch, 6);

console.log("SUDT lifecycle proof passed.");
console.log("Issued: 2300 | Alice: 1200 | Bob: 1100 | Pending: 0 | Epoch: 6");
