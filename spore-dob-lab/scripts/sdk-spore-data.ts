import {
  bufferToRawString,
  bytifyRawString,
  packRawSporeData,
  unpackToRawSporeData,
} from "@spore-sdk/core";
import { decodeDob } from "../lib/dob";

const dna = "0x7ac19e455601ff0088aabbccddeeff00";
const dob = decodeDob(dna);
const payload = JSON.stringify({
  protocol: "dob/1",
  dna,
  pattern: dob.pattern,
  traits: Object.fromEntries(dob.traits.map((trait) => [trait.name, trait.value])),
});

const packed = packRawSporeData({
  contentType: "application/json",
  content: bytifyRawString(payload),
  clusterId: "0x21a30f2b2f4927dbd6fd3917990af0dbb868438f44184e84d515f9af84ae4861",
});

const unpacked = unpackToRawSporeData(packed);
const decodedContent = bufferToRawString(unpacked.content);
const parsed = JSON.parse(decodedContent) as { dna: string; pattern: string };

if (parsed.dna !== dna) {
  throw new Error(`SDK SporeData round-trip DNA mismatch: ${parsed.dna}`);
}

if (parsed.pattern !== dob.pattern) {
  throw new Error(`SDK SporeData round-trip pattern mismatch: ${parsed.pattern}`);
}

console.log("Spore SDK data round-trip passed.");
console.log(`Packed bytes: ${packed.byteLength}`);
console.log(`Content type: ${unpacked.contentType}`);
console.log(`DOB pattern: ${parsed.pattern}`);
