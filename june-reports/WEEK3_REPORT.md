# Weekly Report - CKBuilders Learning Journey

## Overview

This report covers the current Week 6 direction, following last week's work on the **SUDT Operations Lab** and **DAO Observatory**. The major update this week is a move from protocol lifecycle simulation into **rich digital objects on CKB**: Spore Protocol, DOB rendering, Spore SDK workflows, and Script-Sourced Rich Information (SSRI).

The work has now moved from research and architecture mapping into an implemented lab. A new `spore-dob-lab/` project was added to connect:

- **Spore Protocol** as the CKB-native digital object standard,
- **DOB/0 and DOB/1** as interpretation and rendering layers,
- **Spore SDK** as the application-facing toolchain,
- **SSRI** as a way for scripts to expose richer information and behavior to off-chain applications.

The goal is to extend the previous educational labs from "how cells move value" into "how cells can carry, describe, render, and expose programmable digital objects."

---

## Major continuation from last week: from protocol cells to digital object cells

Last week's work ended with two substantial protocol reconstructions:

| Previous lab | What it proved |
|--------------|----------------|
| `sudt-operations-lab` | fungible-token supply conservation across ACP and cheque cells |
| `dao-observatory` | DAO deposits, withdrawal headers, epoch locks, and compensation accounting |

This week builds on the same pattern, but applies it to digital objects.

The new direction is not just "mint an NFT." The research centers on how CKB's cell model enables digital assets that are:

- fully on-chain,
- redeemable for intrinsic CKByte value,
- transferable with preserved privacy properties,
- represented by one cell per digital object,
- interpretable through DOB schemas and decoders,
- potentially enriched by script-sourced methods through SSRI.

The resulting artifact is a **Spore / DOB / SSRI Observatory**: a learning lab that explains and simulates the lifecycle of a Spore object from creation, to transfer, to melt, while also showing how DOB metadata and rendering are layered on top.

---

## Spore Protocol study: digital objects as first-class cells

The first area of work was a comprehensive pass through the Spore Protocol documentation.

Spore is positioned as an on-chain Digital Object protocol on Nervos CKB. Unlike traditional NFT patterns that often point to off-chain metadata, Spore stores digital-object content directly on CKB and links the object to the CKBytes used to create it.

### Concepts mapped this week

| Concept | Working understanding |
|---------|----------------------|
| Spore | one digital object represented by one CKB cell |
| Intrinsic value | the object is backed by CKBytes locked in the cell |
| Melt | the owner can redeem the object back into underlying CKB |
| Zero-fee transfer | extra capacity margin can be reserved to pay future transaction fees |
| Privacy | transfer flow can avoid obvious address-linking patterns by preserving cell-model privacy properties |
| Multi-content support | Spore can represent more than static image NFTs |

The important learning shift is that Spore is not merely a marketplace asset format. It is a **cell-native digital object model**, where the object, its ownership, its content, and its redeemable value all live inside the same CKB design space.

### How this connects to previous work

The SUDT and DAO labs both taught that a type script gives meaning to cell data. Spore extends that lesson:

- SUDT cell data means "amount of this fungible token."
- DAO cell data means "deposit or withdrawal state."
- Spore cell data means "digital object content and metadata."

So the Week 6 work starts to unify the mental model:

```text
Cell capacity = economic backing
Cell lock     = ownership and spend authority
Cell type     = asset/protocol rule
Cell data     = object state or object content
```

---

## DOB Protocol research: from stored data to interpretable objects

The second area of work was DOB, especially the DOB/0 and DOB/1 protocol family.

The key insight is that a digital object is not useful only because bytes are stored on-chain. Applications need a standard way to interpret those bytes. DOB provides this interpretation layer.

### DOB/0

DOB/0 introduces the base model for interpreting a digital object:

- **DNA** - the core data structure of the object,
- **Pattern** - the schema or template used to interpret that data,
- **Decoder** - the logic that reads the DNA and produces meaningful attributes.

This matters because it separates raw storage from meaning. The same cell-model foundation can support many object types if applications agree on how to decode them.

### DOB/1

DOB/1 adds a rendering-oriented layer, especially around SVG output. The working goal for the planned lab is to show how DOB attributes can become a visual object, not only JSON-style metadata.

The intended lab flow is:

```text
Spore cell data
  -> DOB DNA
  -> Pattern
  -> Decoder
  -> attributes
  -> rendered preview
```

This is a natural continuation of the DAO Observatory's "cell anatomy" view, but applied to a richer object.

---

## DOB Cookbook pass: implementation patterns and visual effects

The `sporeprotocol/dob-cookbook` repository was reviewed as the practical implementation source for DOB issuers. The cookbook is useful because it moves beyond abstract definitions and shows how DOB issuers structure examples, best practices, and rendering effects.

The working extraction from the cookbook is:

1. define an object pattern,
2. encode traits into DNA,
3. decode the DNA deterministically,
4. render a preview,
5. keep issuer-side conventions understandable for downstream apps.

The implementation starts with a small DOB object rather than an overbuilt collection. The first version of the lab focuses on clarity:

- generate a small deterministic DNA payload,
- decode that payload into traits,
- render a simple SVG visual result,
- show where the payload sits in a Spore-like cell,
- show which parts belong to Spore and which parts belong to DOB.

This keeps the implementation close to the cookbook direction while still matching the style of the previous interactive labs.

---

## Spore SDK exploration: create, transfer, melt, and data handling

The Spore SDK documentation was mapped into an implementation checklist. The SDK is TypeScript-based and exposes tools for interacting with Spores and Clusters, composing transactions, and encoding or decoding Spore/Cluster data.

### Recipes selected for replication

The how-to recipe categories were scoped into four workflows:

| Recipe area | Planned lab representation |
|-------------|----------------------------|
| Create | construct a new Spore object with content and capacity |
| Transfer | move ownership to another lock while preserving object identity |
| Melt | redeem the Spore back into CKB capacity |
| Data | inspect content type, payload, and decoded object fields |

The implementation target is not a production wallet. It is a controlled learning environment that explains transaction anatomy:

- inputs required,
- outputs created,
- type script role,
- lock script ownership,
- content payload,
- capacity margin,
- melt path.

### Browser/tooling consideration

Because the Spore SDK is designed for TypeScript and browser usage but may require Node polyfills in web environments, this week also included architecture planning around where the lab should run:

- **offline simulator first** for deterministic learning,
- **SDK-backed script second** for devnet or testnet experiments,
- **browser UI third** after the transaction model is stable.

The first step is now complete: `spore-dob-lab/` proves the model offline and exposes it in a browser UI.

---

## SSRI research: scripts as information sources, not only verifiers

The second major research track was **Script-Sourced Rich Information (SSRI)**.

This connects directly to the Rust script work from last week. Previously, scripts were treated primarily as verifiers: a script accepts or rejects a transaction. SSRI adds another mental model: scripts can also expose standardized information and helper behavior to off-chain applications.

### Core SSRI ideas studied

| SSRI idea | Current understanding |
|----------|----------------------|
| Script-sourced information | scripts can describe behavior or metadata rather than only validate |
| Method paths | methods are addressed by the first 8 bytes of the CKB hash of a method signature |
| Trait-style behavior | scripts can implement standard method groups, similar to Rust traits |
| Off-chain execution | a script can run in CKB-VM outside a transaction to return structured information |
| Interoperability | applications can query scripts for metadata, cell deps, supported methods, or transaction-building hints |

This is especially relevant after the SUDT work. Token metadata is often duplicated off-chain. SSRI suggests a stronger model where information such as symbol, decimals, methods, or required dependencies can be sourced from the script itself.

### `ckb-ssri-std`

The `ckb-ssri-std` crate was identified as the Rust-side standard library entry point for experimenting with SSRI-style scripts. The planned follow-up is to add a small Rust script that can:

- keep normal verifier behavior when no method is requested,
- respond to a small set of SSRI method paths,
- expose at least a `version` method,
- expose a method list,
- demonstrate how script behavior can be queried off-chain.

This will connect the existing `rust-script-lab` to the new SSRI track instead of starting from scratch.

---

## Implemented artifact: Spore / DOB / SSRI Observatory

The major deliverable is a new lab that combines the above threads.

### Planned modules

| Module | Purpose |
|--------|---------|
| Spore Cell Anatomy | shows capacity, lock, type, content type, data payload, cluster id, and owner |
| Create Flow | simulates a Spore-like creation transaction with intrinsic CKB backing |
| Transfer Flow | shows object identity preserved while lock ownership changes |
| Melt Flow | shows intrinsic value redemption back into ordinary CKB |
| DOB Decoder | turns DNA/pattern data into visible traits |
| DOB Renderer | renders a deterministic SVG-style object preview |
| SSRI Explorer | shows how scripts can expose rich information through method paths |

The goal is the same as the DAO Observatory: not just a form, but an explanation of the hidden protocol mechanics.

### Current implementation status

The first implementation pass is complete:

- `spore-dob-lab/` scaffold created,
- deterministic Spore lifecycle model implemented,
- create, transfer, and melt flows implemented,
- object identity and capacity conservation checks implemented,
- DOB DNA decoder implemented,
- deterministic SVG renderer implemented,
- transaction anatomy panel implemented,
- SSRI demo method explorer implemented,
- `@spore-sdk/core` added for SDK-facing checks,
- SporeData encode/decode round-trip implemented with the SDK,
- create/transfer/melt SDK recipe-shape script added,
- `rust-script-lab` extended with an SSRI method dispatch demo,
- lifecycle proof added,
- TypeScript and production build verified.

The proof currently checks object identity, capacity conservation, DOB decoding, transfer, melt, and SSRI method lookup.

```powershell
cd spore-dob-lab
npm run run:all
```

Verification result:

```text
Spore/DOB/SSRI lifecycle proof passed.
Final collector wallet: 1,642.9997 CKB
SSRI demo method path: 0xe9801f12d29c26a0
Spore SDK data round-trip passed.
Spore SDK recipe surface is available.
SSRI method dispatch demo passed.
```

---

## RGB++ Observatory: Bitcoin seals with CKB programmable state

The next major addition is `rgbpp-observatory/`, an offline-first lab for the RGB++ Protocol. This extends the Week 6 digital-object work into Bitcoin-linked assets and demonstrates how RGB++ combines Bitcoin's UTXO security model with CKB's script programmability.

The lab models the central RGB++ transaction flow:

```text
off-chain computation
  -> Bitcoin transaction with OP_RETURN commitment
  -> CKB transaction with RGB++ state transition
  -> on-chain verification through RGB++ script gates
```

### Concepts implemented

| Concept | Lab representation |
|---------|--------------------|
| Single-use seal | a Bitcoin UTXO is consumed exactly once when ownership changes |
| Isomorphic binding | each active Bitcoin UTXO maps to one active CKB cell |
| OP_RETURN commitment | the Bitcoin transaction commits to the CKB state transition |
| SPV verification | validation gate checks Bitcoin transaction witness/proof shape |
| CKB state validation | the RGB++ xUDT amount remains conserved while owner seals rotate |
| Explorer view | the UI shows paired BTC/CKB transactions and binding history |

The proof executes Alice -> Bob -> Alice transfers and checks seal rotation, CKB/Bitcoin ownership alignment, OP_RETURN commitment matching, SPV gate status, and RGB++ xUDT amount conservation.

```powershell
cd rgbpp-observatory
npm run run:all
```

Verification result:

```text
RGB++ paired transaction proof passed.
Active owner: alice
Bitcoin tx count: 2
CKB tx count: 2
```

This work connects directly to the RGB++ documentation: Bitcoin UTXOs provide the single-use ownership seal, while CKB cells store programmable asset state and validate transitions through scripts.

---

## Why this matters for the CKBuilders arc

This week's work pushes the learning journey into a more advanced part of CKB application design.

Earlier weeks answered:

- How do scripts validate transactions?
- How do cells hold value?
- How do tokens move?
- How does the DAO enforce monetary policy?

This week begins answering:

- How do cells hold rich digital objects?
- How do applications interpret those objects consistently?
- How can digital objects carry intrinsic redeemable value?
- How can scripts expose metadata and behavior to applications?
- How do DOB and SSRI reduce off-chain convention drift?
- How can Bitcoin UTXO ownership be bound to CKB script-validated state?

That is the core progression: from **cell mechanics** to **cell-native objects** to **Bitcoin-secured programmable assets**.

---

## Consolidated progress

1. **Spore literacy implemented:** Spore has been modeled as a one-cell digital object with intrinsic CKB backing and meltability.
2. **DOB literacy implemented:** DOB-style DNA decoding and SVG rendering now exist in the lab.
3. **Cookbook analysis applied:** the lab uses a small reproducible object flow rather than an overbuilt collection.
4. **SDK planning represented:** create, transfer, melt, and data flows are exposed as transaction-anatomy modules.
5. **SSRI research implemented:** method paths and script-sourced responses are represented in an SSRI explorer and a Rust-script-lab dispatch demo.
6. **RGB++ literacy implemented:** single-use seals, isomorphic binding, OP_RETURN commitments, and SPV gates are represented in `rgbpp-observatory/`.
7. **New labs delivered:** `spore-dob-lab/` and `rgbpp-observatory/` are now the Week 6 artifacts.

---

## Next steps

- Add a real transaction-building Spore SDK script once the devnet/testnet target is chosen.
- Compare the offline transaction anatomy with actual `@spore-sdk/core` transaction skeletons from a funded account.
- Move the SSRI dispatch demo from JavaScript into a minimal Rust/CKB-VM contract experiment.
- Replace the browser demo SSRI path function with production CKB-hash-compatible method paths.
- Add negative tests for invalid DNA, exhausted capacity margin, and unauthorized melt/transfer attempts.
- Connect `rgbpp-observatory` to a real RGB++ SDK flow once a testnet Bitcoin UTXO and CKB account are available.
- Add a btc-assets-api read-only probe for real RGB++ assets and transactions.

---

## References

- [Spore Protocol - Nervos Docs](https://docs.nervos.org/docs/tech-explanation/spore-protocol)
- [Spore Protocol Docs](https://docs.spore.pro/)
- [DOB Cookbook](https://github.com/sporeprotocol/dob-cookbook)
- [Spore How-to Recipes](https://docs.spore.pro/category/how-to-recipes)
- [Spore SDK](https://docs.spore.pro/resources/spore-sdk)
- [Script-Sourced Rich Information discussion](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256/2)
- [`ckb-ssri-std` crate](https://crates.io/crates/ckb-ssri-std)
- [RGB++ Introduction](https://rgbpp.com/docs/introduction)
- [RGB++ Resources](https://rgbpp.com/docs/resources)
- [RGB++ Light Paper](https://talk.nervos.org/t/rgb-protocol-light-paper-translation/7790)
- [RGB++ Explorer](https://explorer.rgbpp.io/en)
