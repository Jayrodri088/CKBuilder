# Week 3 Report — CKBuilders Learning Journey

## Overview

This report covers the period after the hash-lock and CCC foundation work: moving from **single tutorials** into **runnable labs**, **SDK and CLI tooling**, **payment-channel concepts**, and a **weekend-scale capstone** (**CKB Pay Link**) that turns the hash-lock stack into something another builder could actually demo.

The emphasis remains on what changed in understanding and what was shipped as code—not a directory inventory.

---

## Shift in approach: proof over reading

Earlier work established that CKB failures are often **chain-state mismatches**, not TypeScript bugs. Week 3 pushed that further: each new topic was expressed as **scripts and small apps** that either pass against a live devnet or fail loudly with a clear message.

That produced four focused repos under the same workspace, each with a `run:all` or `preflight` entry point so “I read the docs” became “I can run the docs.”

---

## CCC training lab: tying API vocabulary to live checks

CCC documentation (app scenarios, playground, code examples, API index) is broad. The training lab does not duplicate it as markdown; it encodes **invariants** you can run:

- **Cell-dep liveness** — `get_live_cell` on the hash-lock dep from `scripts.json`; catches stale deployment after devnet reset before any UI work.
- **Hash-lock derivation** — same preimage → hash → lock args → address path as the simple-lock frontend, printable in the terminal.
- **Lifecycle proof** — documents the CCC transfer phases (outputs → fill inputs → fees → witness → send) as assertions against real project code.
- **Playground parity** — RPC queries that group cells by lock/type and surface capacity vs data occupancy without the web UI.

**Learning outcome:** CCC is not one package named `core`; it is a **layered toolkit**. The practical skill is knowing which layer you need (primitives and tx shaping vs connectors) and verifying behavior on **this** RPC endpoint, not a generic testnet example address.

---

## Payment channels lab: L1 vs Fiber vs Perun as a teachable model

Payment channels were studied as **architecture**, not as a from-scratch implementation of Fiber.

The lab includes:

- A **channel state machine** aligned with Fiber’s documented lifecycle (negotiate → collaborate → sign → ready → close).
- An **offline simulator** that opens a channel, moves balance off-chain, and closes while conserving total capacity—making “off-chain update” tangible without a live node.
- An optional **Fiber RPC probe** (`node_info`, `list_channels`) when a node listens on the usual dev port.

**Learning outcome:** L1 CKB cells fund and settle trust; Fiber-style channels optimize **repeated** transfers between the same parties. The simulator is not a wallet replacement; it is a **mental model trainer** plus a hook for real RPC when infrastructure exists. Perun sits in the comparison as an alternative construction philosophy, not something this repo implements end-to-end.

---

## Rust SDK and ckb-cli lab: two ways to talk to the same node

The [Nervos Rust SDK](https://docs.nervos.org/docs/sdk-and-devtool/rust) and [ckb-cli](https://docs.nervos.org/docs/sdk-and-devtool/ckb-cli) docs were turned into **`ckb-rust-cli-lab`** with a deliberate split:

| Track | Role |
|--------|------|
| **Node + CCC** (primary) | `get_tip_block_number`, `get_block_by_number`, generate/parse address, compare RPC with `ckb-cli` when installed |
| **Rust `ckb-sdk`** (optional, `rust/`) | Same exercises via `CkbRpcClient` and address APIs |
| **ckb-cli** (optional) | `rpc get_tip_block_number` when on PATH |

**Windows toolchain lesson (important):** Building full `ckb-sdk` on Windows is not only “pick MSVC vs GNU.” The default **GNU** toolchain fails without MinGW `gcc`/`dlltool`. Switching to **MSVC** fixes most crates, but **`ckb-vm` still invokes `gcc`** to assemble VM code on Windows. The workable setup is:

1. `rustup default stable-x86_64-pc-windows-msvc`
2. MSYS2 + `mingw-w64-x86_64-gcc`, with `C:\msys64\mingw64\bin` on PATH
3. Project pin via `rust-toolchain.toml` so the lab does not silently revert to GNU

**Learning outcome:** SDK choice (Rust vs TypeScript) is separate from **host toolchain** choice. For workshop machines, a **Node-first lab with optional Rust** is more reliable than assuming every builder can compile `ckb-vm` locally.

---

## Capstone planning: from “everything” to one weekend product

The programme assignment asks for a **mini application** with ecosystem value. Several directions were evaluated (token mint desk, full builder console, Fiber bridge, ops tooling). The constraint that mattered was **credible MVP in a weekend** while still demonstrating real CKB ideas.

**Decision: CKB Pay Link** — hash-lock **payment requests** on devnet:

1. Merchant **creates** a request (label, amount, secret preimage).
2. Payer receives a **link without the secret** and funds the **derived lock address**.
3. Merchant **claims** with the preimage in the witness (same unlock path as simple-lock).

This reuses the hardest won work (contract, deployment metadata, CCC unlock, cell-dep discipline) and adds **product UX** plus **preflight scripts**—the combination that is missing from tutorial repos alone.

---

## CKB Pay Link: what was delivered

**Location:** `ckb-pay-link/`

| Piece | Purpose |
|--------|---------|
| Next.js UI | Tabs: **Create** → **Pay** (payer view / query params) → **Claim** |
| `pay-link.ts` | Lock derivation and `claimPayment` (from simple-lock patterns) |
| `sync:deployment` | Copies `scripts.json` / `system-scripts.json` from `simple-lock` so one deployment source stays canonical |
| `preflight` | RPC reachability + live hash-lock cell dep |
| `demo` | Scripted preflight + printed manual demo steps for reviewers |

**Design choices that matter:**

- **Payer link excludes the preimage** — only address, amount, and label; the secret stays with the merchant for claim. That is the difference between a toy hash demo and a minimal “invoice” story.
- **Preflight before demo** — encodes the Week 1–2 lesson that resolution errors should be caught before opening the UI.
- **No new contract** — scope stays shippable; impact is integration and reliability, not novel script auth.

Production build of the frontend was verified; preflight requires OffCKB devnet on `http://127.0.0.1:28114` like the other labs.

---

## Consolidated outcomes (Week 3)

1. **Lab discipline:** New topics ship as runnable repos with pass/fail output, not notes folders.
2. **L2 literacy:** Channels are understood as funded L1 state plus off-chain updates; Fiber RPC is optional proof, not a blocker for learning.
3. **Tooling literacy:** Rust on Windows needs MSVC **and** MinGW gcc for `ckb-vm`; Node/CCC remains the dependable demo path.
4. **Product literacy:** A capstone can be small if it **composes** prior work (lock + deployment + CCC + preflight) into one user-visible flow—**CKB Pay Link** is that composition.
5. **Ecosystem angle:** Pay Link is workshop-ready: payer link, cell-dep check, and a five-minute demo script suitable for DevRel or programme review.

---

## What remains (honest next steps)

- **ckb-cli** on PATH for full “Node vs CLI” comparison in `ckb-rust-cli-lab` (optional).
- **Pay Link:** wallet connector, QR codes, or timeout/refund locks—explicitly out of weekend MVP.
- **Fiber:** funded channel on a shared testnet, if DevRel provides node + faucet guidance.
- **Programme review:** walk Neon through `pnpm run demo` in `ckb-pay-link` after `sync:deployment` + devnet up.

---

## References

- [Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock)
- [Rust SDK](https://docs.nervos.org/docs/sdk-and-devtool/rust)
- [CKB-CLI](https://docs.nervos.org/docs/sdk-and-devtool/ckb-cli)
- [CCC App](https://docs.ckbccc.com/docs/ccc-app/)
- [CCC Playground](https://docs.ckbccc.com/docs/playground/)
- [CCC Code Examples](https://docs.ckbccc.com/docs/code-examples/)
- [Fiber basic transfer (channel states)](https://docs.fiber.world/docs/quick-start/basic-transfer)
