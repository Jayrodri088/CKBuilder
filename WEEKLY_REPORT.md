# Weekly Report — CKBuilders Learning Journey

## Overview

This report describes the learning process from hands-on work on CKB dApp development: a full-stack **hash-lock** example on ckb-js-vm, operating it reliably on **Windows with OffCKB devnet**, and connecting **CCC** concepts to runnable checks against real RPC and real project code.

The emphasis is on what changed in understanding—not a feature list for its own sake.

---

## Learning arc: from tutorial code to chain truth

### Starting point

The official **Simple Lock** flow reads simply on paper: build bytecode, deploy, point the frontend at deployment metadata, deposit to an address, transfer by supplying the preimage in the witness. In practice, each step assumes agreement between **four** things: your toolchain, your **current** devnet state, the **exact** script binaries you reference, and the **lock parameters** (preimage → hash → args) that define “where the money lives.”

### What deepened first: deployment is part of the program, not a one-time setup

Early failures showed that `scripts.json` is not decorative configuration. It pins **cell dependencies**—concrete `OutPoint`s that must exist on the chain your RPC talks to. When devnet was reset or metadata came from another environment, the node could not resolve those cells, and the client surfaced **`TransactionFailedToResolve`**.

That forced a concrete mental model:

- **Resolve** means the node can load every referenced live cell for deps and inputs.
- A “green” UI or correct TypeScript is irrelevant if the **out-point graph** does not match chain state.

Learning here was operational: verify liveness (`get_live_cell`), redeploy when the chain is fresh, and treat **copying `deployment/scripts.json` into the frontend** as a first-class release step, not an afterthought.

### Second layer: the address is not “the tutorial address”

A separate lesson came from **funding**. Depositing CKB to an address from documentation does not automatically fund **your** lock. The visible CKB address is fully determined by **your** deployed `hash-lock.bc` metadata and **your** chosen preimage (hash in lock args, wrapped by ckb-js-vm loader args). Same preimage string with different deployment or different code hash yields a different address.

So the learning outcome was: always align **funds** with the **derived lock** the application actually uses, and treat address derivation as something you can **recompute and check** (not only trust in the UI).

### Third layer: Windows is a first-class environment, not an edge case

Tooling assumptions bit in predictable places:

- Invoking `esbuild` as `./node_modules/.bin/esbuild` on Windows failed; the fix path was explicit `.cmd` and shell invocation where needed.
- Bytecode generation required **`ckb-debugger`**; a `cargo install` path failed when GNU `dlltool` was missing, so the workable path was a **prebuilt** debugger binary and a resolver that prefers a known local path or `CKB_DEBUGGER_BIN`, then PATH.

That reinforced a general lesson: **documented “pnpm build” flows assume a POSIX-style toolchain** unless stated; making them reliable on Windows is part of learning CKB in a real dev setup, not extra credit.

### Fourth layer: deploy scripts must run when you think they run

`pnpm run deploy` appeared to succeed at the build stage while never reaching `offckb deploy`. Root cause was a fragile **“am I the main module?”** check using `import.meta.url` string equality with `process.argv[1]`, which breaks on Windows path normalization.

Learning: **CLI entrypoints** need boring, portable guards (`path.resolve` + `fileURLToPath`). Silent no-op deploys are worse than loud failures because they leave `scripts.json` stale while you assume a new deployment.

---

## CCC learning: from documentation pages to enforced invariants

Reading CCC docs (app scenarios, playground visualization, minimal transaction examples, API modules) is one thing; **retaining** it requires tying vocabulary to behavior.

### Code examples → lifecycle discipline

The minimal CCC transfer pattern separates **declaring outputs**, **filling inputs by capacity**, **fee completion**, and **send**. Inspecting the hash-lock frontend implementation turned that into a checkable story: order of operations in the source file must respect funding before witness finalization and broadcast.

That is how “I read the examples” became “I can point to where each phase happens in real code.”

### Playground → same idea without the GUI

Playground teaches that cells have **lock** and **type** roles and that visual grouping encodes “who owns” versus “what asset logic applies,” plus how **capacity** vs **stored data** competes for the same cell economics.

A small CLI utility was added that queries live cells for two locks and prints **group counts** by lock script identity and type script identity, plus a crude **data occupancy vs capacity** signal. It is not a replacement for the web playground; it is a **parity exercise**: forcing the same concepts to appear in logs you can diff and script in CI later.

### API surface → where to look when extending

The generated API index lists many packages (`core`, connectors, domain packages). The practical learning is architectural: **`core`** for primitives and transaction shaping, other packages when you integrate wallets or protocol-specific features—avoid treating one import as “the whole CCC.”

---

## Consolidated outcomes (what “learned” means here)

1. **Chain-state literacy:** deployment artifacts and RPC truth must match; errors are often resolution, not “CCC bugs.”
2. **Lock literacy:** addresses are script encodings; funding must target the lock you actually built for this devnet and preimage.
3. **Toolchain literacy:** Windows paths, bytecode tooling, and non-interactive deploy confirmations are part of the delivery surface.
4. **SDK literacy:** CCC transaction phases and cell-model grouping language can be mapped onto real files and live cells, not only tutorials.

---

## References

- [Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock)
- [CCC App](https://docs.ckbccc.com/docs/ccc-app/)
- [CCC Playground](https://docs.ckbccc.com/docs/playground/)
- [CCC Code Examples](https://docs.ckbccc.com/docs/code-examples/)
- [CCC API documentation](https://api.ckbccc.com/)
- [ckb-standalone-debugger releases](https://github.com/nervosnetwork/ckb-standalone-debugger/releases)
