import assert from "node:assert/strict";
import {
  advanceEpochs,
  ckb,
  compensation,
  deposit,
  finalizeWithdrawal,
  formatCkb,
  initialState,
  requestWithdrawal,
  validateState,
} from "../lib/dao-model";

let state = deposit(initialState(), ckb(10_000));
state = advanceEpochs(state, 170);
const liveCompensation = compensation(state);
assert(liveCompensation > 0n);

state = requestWithdrawal(state);
assert.equal(state.claimEpoch, 1180);
const frozenCompensation = compensation(state);

state = advanceEpochs(state, 10);
assert.equal(compensation(state), frozenCompensation);
state = finalizeWithdrawal(state);
validateState(state);

assert.equal(state.phase, "withdrawn");
assert.equal(state.wallet, ckb(15_000) + ckb(10_000) + frozenCompensation);

console.log("Nervos DAO lifecycle proof passed.");
console.log(`Claim epoch: 1180 | Compensation: ${formatCkb(frozenCompensation, 8)} CKB`);
