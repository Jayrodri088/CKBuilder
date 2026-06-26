# Spore DOB Lab

An offline-first observatory for Spore Protocol, DOB decoding/rendering, and
SSRI-style method exploration on CKB.

This lab does not submit transactions. It models the protocol mechanics that a
real Spore SDK or wallet flow would later connect to:

- create a Spore-like cell with intrinsic CKB backing,
- transfer the same object identity to another lock,
- spend capacity margin as simulated zero-fee transfer budget,
- melt the object back into ordinary CKB,
- decode DOB DNA into traits,
- render a deterministic SVG preview,
- explore SSRI-style method paths and script-sourced responses.
- round-trip DOB payloads through `@spore-sdk/core` SporeData utilities.
- inspect the SDK create/transfer/melt recipe payload shapes.

## Run

```powershell
npm install
npm start
```

## Verify

```powershell
npm run run:all
```

The full check runs TypeScript, the lifecycle proof, SDK SporeData round-trip,
SDK recipe-surface check, and production build.

Individual SDK checks:

```powershell
npm run sdk:data
npm run sdk:recipes
```

The proof checks object identity, capacity conservation, DOB decoding, transfer,
melt, and SSRI demo method lookup.

## Sources

- [Spore Protocol - Nervos Docs](https://docs.nervos.org/docs/tech-explanation/spore-protocol)
- [Spore Docs](https://docs.spore.pro/)
- [DOB Cookbook](https://github.com/sporeprotocol/dob-cookbook)
- [Spore SDK](https://docs.spore.pro/resources/spore-sdk)
- [Script-Sourced Rich Information](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256/2)
- [`ckb-ssri-std`](https://crates.io/crates/ckb-ssri-std)
