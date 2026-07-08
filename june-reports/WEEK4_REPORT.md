# Week 6 Report - CKBuilders Learning Journey

## Overview

This report covers work completed during the week of **June 23 to June 28, 2026**. The main theme was moving from earlier protocol lifecycle labs into **advanced CKB asset infrastructure**:

- Spore Protocol and DOB-style digital objects,
- Spore SDK data handling,
- Script-Sourced Rich Information (SSRI),
- RGB++ isomorphic binding between Bitcoin UTXOs and CKB cells.

The week produced two new educational labs and one extension to the Rust script track:

| Artifact | Purpose |
|----------|---------|
| `spore-dob-lab/` | models Spore, DOB decoding/rendering, SDK data flows, and SSRI-style methods |
| `rgbpp-observatory/` | models RGB++ single-use seals, OP_RETURN commitments, SPV gates, and CKB state transitions |
| `rust-script-lab/scripts/ssri-method-demo.mjs` | demonstrates SSRI-style method-path dispatch |

The emphasis remained the same as previous weeks: convert protocol documentation into runnable, inspectable models with proofs rather than only notes.

---

## Spore / DOB / SSRI Observatory

The first major deliverable was `spore-dob-lab/`, an offline-first lab for Spore Protocol, DOB rendering, and SSRI-style script metadata.

### What was implemented

The lab models a Spore-like object as a CKB cell with:

- intrinsic CKB backing,
- content/DOB data,
- a type-script role,
- owner lock state,
- capacity margin for future transfers,
- a melt path back into ordinary CKB.

The core lifecycle is:

```text
Create Spore cell -> Transfer ownership -> Melt back into CKB
```

The model checks that object identity remains stable during transfer and that capacity remains conserved through create, transfer, and melt.

### DOB decoding and rendering

A deterministic DOB decoder was added. It takes DNA bytes and derives:

- shape,
- aura,
- texture,
- ring count,
- symmetry,
- serial traits,
- color palette.

Those traits are rendered into a deterministic SVG preview, making the difference between raw on-chain bytes and interpreted digital-object meaning visible.

### Spore SDK integration

The lab was extended with `@spore-sdk/core` checks:

- `sdk-spore-data.ts` round-trips a DOB payload through SporeData packing/unpacking.
- `sdk-recipe-shapes.ts` verifies that the SDK exposes `createSpore`, `transferSpore`, and `meltSpore`, then prints the transaction-shape expectations for those flows.

This bridges the offline educational model with the real SDK surface without requiring a funded wallet or live network during the learning phase.

### Verification

```powershell
cd spore-dob-lab
npm run run:all
```

Verified outputs include:

```text
Spore/DOB/SSRI lifecycle proof passed.
Spore SDK data round-trip passed.
Spore SDK recipe surface is available.
Production build passed.
```

---

## SSRI Method Dispatch Demo

The second focused addition was an SSRI-style demo under `rust-script-lab/`.

Although it is currently implemented as a JavaScript dispatch model, it connects directly to the Rust script direction from earlier weeks. The demo shows how script-sourced information can be addressed by method paths and dispatched into structured responses.

Implemented method examples:

- `SSRI.version`
- `SSRI.supported_methods`
- `Spore.cell_deps`
- `DOB.decode`

Verification:

```powershell
cd rust-script-lab
npm run ssri:demo
```

Result:

```text
SSRI method dispatch demo passed.
```

**Learning outcome:** scripts can be thought of not only as transaction verifiers, but also as structured information sources for wallets, SDKs, and indexers.

---

## RGB++ Observatory

The second major lab was `rgbpp-observatory/`, based on RGB++ documentation and the RGB++ light-paper model.

The purpose was to understand how RGB++ combines:

- Bitcoin's UTXO model,
- single-use seals,
- CKB cells,
- CKB scripts,
- OP_RETURN commitments,
- SPV/light-client verification.

### Protocol model

The lab models the RGB++ transfer flow as a paired Bitcoin/CKB process:

```text
Off-chain computation
  -> Bitcoin transaction with OP_RETURN commitment
  -> CKB transaction with RGB++ state transition
  -> RGB++ script verification gates
```

### Concepts represented in the UI

| Concept | Lab representation |
|---------|--------------------|
| Single-use seal | Bitcoin UTXO is consumed exactly once during ownership change |
| Isomorphic binding | active Bitcoin UTXO maps to active CKB cell |
| OP_RETURN commitment | Bitcoin transaction commits to the CKB transition |
| SPV validation | validation gate checks Bitcoin witness/proof shape |
| CKB state | RGB++ xUDT amount is stored and validated on CKB |
| Explorer view | paired Bitcoin/CKB transactions are shown side-by-side |

### Verification

```powershell
cd rgbpp-observatory
npm run run:all
```

Proof output:

```text
RGB++ paired transaction proof passed.
Active owner: alice
Bitcoin tx count: 2
CKB tx count: 2
```

The proof executes Alice -> Bob -> Alice transfers and checks:

- seal rotation,
- Bitcoin/CKB ownership alignment,
- OP_RETURN commitment matching,
- SPV gate status,
- RGB++ xUDT amount conservation.

**Learning outcome:** RGB++ makes Bitcoin UTXOs act as ownership seals while CKB cells carry programmable asset state.

---

## How the Week Fits the Larger Arc

| Previous focus | Week 6 extension |
|----------------|------------------|
| CKB cells as programmable state | Spore cells as rich digital objects |
| Type scripts and data interpretation | DOB decoding/rendering |
| Script execution and Rust scripts | SSRI method dispatch |
| xUDT and token movement | RGB++ assets bound to Bitcoin UTXOs |
| Fiber probe work | Fiber Flightcheck hackathon readiness tooling |

The overall learning progression is now:

```text
Cell mechanics
  -> scripts and validation
  -> token and DAO protocols
  -> digital objects
  -> Bitcoin-secured CKB assets
  -> live Fiber infrastructure diagnostics
```

---

## Fiber Flightcheck Hackathon Kickoff

The final part of the month also started the Fiber hackathon project direction. This grew out of the earlier CKB Pay Link Fiber probe work and the RGB++/infrastructure research: instead of building another payment UI first, the project direction shifted toward a practical **Fiber readiness layer**.

The initial product idea was scoped as **Fiber Flightcheck**: a tool that answers whether a Fiber node is ready to support a payment request before an application attempts the payment.

The starting checklist included:

- FNN RPC reachability,
- peer availability,
- channel lifecycle state,
- send and receive liquidity,
- CKB funding readiness,
- supported asset checks,
- actionable failure reasons for developers and operators.

This work was only at kickoff/planning stage by the end of June, but it established the direction for the next build cycle: turn the Fiber probe work into a live operator/developer app that can be used during the hackathon as a real infrastructure diagnostic tool.

---

## Consolidated Outcomes

1. **Spore literacy:** modeled create, transfer, and melt flows with capacity conservation.
2. **DOB literacy:** decoded DNA into traits and rendered a deterministic visual object.
3. **SDK literacy:** added real Spore SDK data round-trip and recipe-surface checks.
4. **SSRI literacy:** implemented method-path dispatch as a stepping stone toward script-sourced metadata.
5. **RGB++ literacy:** modeled Bitcoin seals, CKB state cells, OP_RETURN commitments, and SPV gates.
6. **Fiber hackathon direction started:** scoped Fiber Flightcheck as a payment-readiness diagnostic layer for FNN-based applications.

---

## Next Steps

- Continue turning SSRI dispatch into a real Rust/CKB-VM experiment.
- Connect Spore and RGB++ labs to real SDK transaction builders when testnet accounts are available.
- Continue Fiber Flightcheck into a runnable MVP with live node checks, channel readiness, liquidity diagnostics, and report export.

---

## References

- [Spore Protocol](https://docs.nervos.org/docs/tech-explanation/spore-protocol)
- [Spore Docs](https://docs.spore.pro/)
- [Spore SDK](https://docs.spore.pro/resources/spore-sdk)
- [DOB Cookbook](https://github.com/sporeprotocol/dob-cookbook)
- [Script-Sourced Rich Information](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256/2)
- [`ckb-ssri-std`](https://crates.io/crates/ckb-ssri-std)
- [RGB++ Introduction](https://rgbpp.com/docs/introduction)
- [RGB++ Resources](https://rgbpp.com/docs/resources)
- [RGB++ Light Paper](https://talk.nervos.org/t/rgb-protocol-light-paper-translation/7790)
- [RGB++ Explorer](https://explorer.rgbpp.io/en)
