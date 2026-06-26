import assert from "node:assert/strict";
import {
  activeCell,
  assertRgbppInvariants,
  finalizeVerification,
  initialState,
  prepareTransfer,
  submitCkbTransaction,
  transferCycle,
  validateLatest,
} from "../lib/rgbpp-model";

let state = initialState();
assert.equal(activeCell(state).owner, "alice");
assertRgbppInvariants(state);

state = prepareTransfer(state, "bob");
assert.equal(state.phase, "btc_submitted");
assert.equal(state.utxos.find((utxo) => utxo.id === "btc-utxo-a1:0")?.spent, true);

state = submitCkbTransaction(state);
assert.equal(state.phase, "ckb_submitted");
assert.equal(activeCell(state).owner, "bob");

const gates = validateLatest(state);
assert.equal(gates.every((gate) => gate.status === "pass"), true);

state = finalizeVerification(state);
assert.equal(state.phase, "verified");
assertRgbppInvariants(state);

state = transferCycle(state, "alice");
assert.equal(activeCell(state).owner, "alice");
assertRgbppInvariants(state);

console.log("RGB++ paired transaction proof passed.");
console.log(`Active owner: ${activeCell(state).owner}`);
console.log(`Bitcoin tx count: ${state.btcTxs.length}`);
console.log(`CKB tx count: ${state.ckbTxs.length}`);
