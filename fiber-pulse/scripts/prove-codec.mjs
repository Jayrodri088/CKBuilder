import assert from "assert";

// Minimal Node-side roundtrip of the share payload codec (mirrors lib/pay-codec.ts)
function encodePayParam(payload) {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodePayParam(raw) {
  const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

const payload = {
  v: 1,
  id: "abcdef123456",
  label: "Coffee",
  amountCkb: 2.5,
  mode: "invoice",
  createdAt: 1,
  expiresAt: 2,
};

const encoded = encodePayParam(payload);
const decoded = decodePayParam(encoded);
assert.deepStrictEqual(decoded, payload);
console.log("OK: pay-codec roundtrip", encoded.slice(0, 24) + "…");
