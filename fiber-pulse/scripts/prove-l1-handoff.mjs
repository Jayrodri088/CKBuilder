import assert from "assert";

function payLinkOrigin() {
  return "http://127.0.0.1:3000";
}

function buildL1HandoffUrl(req, preimage) {
  const q = new URLSearchParams({
    view: "create",
    from: "pulse",
    amount: String(req.amountCkb),
    label: req.label,
    preimage,
    pulseId: req.id,
  });
  return `${payLinkOrigin()}/?${q.toString()}`;
}

const url = buildL1HandoffUrl(
  { id: "abc123", label: "Coffee", amountCkb: 2.5 },
  "pulse-deadbeef",
);
const u = new URL(url);
assert.equal(u.searchParams.get("from"), "pulse");
assert.equal(u.searchParams.get("view"), "create");
assert.equal(u.searchParams.get("amount"), "2.5");
assert.equal(u.searchParams.get("preimage"), "pulse-deadbeef");
assert.equal(u.searchParams.get("label"), "Coffee");
console.log("OK: L1 handoff URL", url);
