# Week 4 Report — CKBuilders Learning Journey

## Overview

This report covers work after the Week 3 capstone (**CKB Pay Link**): extending Pay Link with a **dual-rail** story (CKB L1 payments vs Fiber L2 probe), clarifying what each layer requires, and completing the first two modules of the official **CKB Script Course**—the validation model and script deployment basics—which tie directly to the hash-lock and deployment work already in this repo.

The emphasis remains on learning outcomes and runnable artifacts, not a file listing.

---

## CKB Pay Link — Phase A: Fiber as read-only L2 rail

Week 3 delivered L1 hash-lock payment requests (create → fund lock address → claim with preimage). Week 4 added **Phase A** for Fiber: connectivity and channel visibility only, not off-chain payments yet.

### What was built

| Piece | Purpose |
|--------|---------|
| **Tab 4. Fiber** | UI panel: L1 vs L2 comparison, probe `node_info`, table of `list_channels` |
| **`/api/fiber` proxy** | Next.js route so the browser can call Fiber JSON-RPC without CORS issues |
| **`check:fiber` / `fiber:status`** | CLI preflight and channel dump (default `http://127.0.0.1:8227`) |
| **`preflight:all`** | CKB RPC + cell dep, then optional Fiber check |

### Design intent

- **L1 rail (unchanged):** Pay Link invoices use hash-lock cells—payer link has address and amount only; merchant keeps the preimage for claim.
- **L2 rail (probe):** Fiber is a **separate node** (FNN), not OffCKB devnet. Empty channel list after a successful probe is still a pass for Phase A; it means “node up, no channels yet.”
- **Phase B (future):** `send_payment` / open channel would sit on this tab; not started in Week 4.

### Operational lesson

`pnpm run check:fiber` fails until a **Fiber Network Node** (`fnn`) is installed and running with RPC on port **8227**. That is expected on a machine that only runs OffCKB for CKB L1. CKB Pay Link’s Create / Pay / Claim tabs do not require Fiber; the Fiber tab and `preflight:all` are optional until FNN is set up per [Run a Fiber Node](https://www.fiber.world/docs/quick-start/run-a-node).

**Learning outcome:** “Works on CKB and Fiber” means **two stacks**—L1 cell locks vs L2 channel network—not one transaction type that magically spans both. Pay Link now documents that split in the product UI instead of only in conversation.

---

## CKB Script Course — Classes 1 and 2 (completed)

The programme script track continues with Nervos’s low-level course. The following modules are **completed** as part of Week 4 study (including hands-on alignment with existing repo work the same week).

### [Class 1: Validation Model](https://docs.nervos.org/docs/script-course/intro-to-script-1)

This class formalizes what was already encountered when debugging **simple-lock** and **Pay Link**—why transactions fail at validation time rather than in the wallet UI.

**Core ideas retained:**

- **Lock script** — required on every cell; defines who may consume (spend) the cell. Input lock scripts must succeed or the whole transaction fails.
- **Type script** — optional rules on how cells may be created or transformed (tokens, custom logic). Input and output type scripts run when present.
- **Execution model** — unique lock and type scripts are **deduplicated** and each runs **once** per transaction; all scripts see the full transaction context; exit code `0` means success.
- **Output lock scripts are not executed** on creation—only inputs’ locks and relevant type scripts— which matches the intuition that funding a new lock address is not the same as spending it.

**Connection to prior work:** `TransactionFailedToResolve` and cell-dep issues are **before** VM execution; lock/type success is **during** validation. Preflight scripts (`get_live_cell` on deps) guard the first layer; script course Class 1 names the second.

### [Class 2: Script Basics](https://docs.nervos.org/docs/script-course/intro-to-script-2)

This class bridges theory to the deployment pipeline already practiced with **ckb-js-vm** and **simple-lock**.

**Core ideas retained:**

- **Script vs script code** — the on-chain `Script` struct (`code_hash`, `hash_type`, `args`) is not the binary; **script code** is the RISC-V program stored in a cell’s data and referenced by hash.
- **CKB-VM = RISC-V** — scripts are real executables in a VM, not a single fixed opcode set; language choice is toolchain-dependent (C in the course examples; Rust recommended in modern docs; JavaScript via interpreters like Duktape / **ckb-js-vm** in this repo).
- **Deploy and run pattern:**
  1. Compile to RISC-V binary.
  2. Place binary in a cell’s data.
  3. Point `code_hash` (+ `hash_type`, `args`) at that code.
  4. Include the code cell as a **cell dep** in spending transactions.
  5. Attach witnesses where the script expects proofs (e.g. preimage bytes).

**Connection to prior work:** `simple-lock`’s `hash-lock.bc`, `scripts.json` cell deps, and Pay Link’s `sync:deployment` are a concrete instance of Class 2’s recipe. The hash in lock **args** is the script-level customization; the preimage in the **witness** is the runtime proof—exactly the split Class 2 sets up for more complex scripts later in the series.

**Learning outcome:** Reading the script course is no longer abstract; Class 1 explains *when* scripts run, Class 2 explains *how code gets on chain*, and the hash-lock capstone is the reference implementation on the JavaScript/RISC-V path already maintained in the workspace.

---

## How Week 4 fits the arc

| Layer | Week 3 | Week 4 |
|--------|--------|--------|
| **Product** | Pay Link L1 MVP | Fiber probe tab + dual-rail messaging |
| **L2 ops** | Simulator in payment-channels-lab | Live RPC probe wired into capstone |
| **Script theory** | Implicit in simple-lock | Class 1–2 explicit in script course |
| **Next** | — | FNN install, script course Class 3+, Fiber Phase B pay |

---

## Consolidated outcomes (Week 4)

1. **Dual-rail clarity:** L1 Pay Link and Fiber probe are integrated in one app but depend on different infrastructure (OffCKB vs FNN).
2. **Phase discipline:** Phase A ships read-only Fiber; payment APIs stay out of scope until channel setup is reliable.
3. **Script foundations:** Validation model and script/code/deployment/witness pipeline are studied and mapped to hash-lock work.
4. **Ecosystem narrative:** Pay Link remains the demo vehicle; script course explains *why* deployment and witnesses matter under the hood.

---

## What remains

- Install and run **fnn** locally so `pnpm run check:fiber` and the Fiber tab show live `node_info` (and eventually channels).
- Continue **script course** beyond Class 2 (syscalls, Duktape/JS paths, Type ID, etc.).
- **Pay Link Phase B:** Fiber payment flow when DevRel confirms testnet/faucet and RPC methods for demos.
- Programme review: `pnpm run preflight` + L1 demo; optional `preflight:all` when Fiber is up.

---

## References

- [Class 1: Validation Model](https://docs.nervos.org/docs/script-course/intro-to-script-1)
- [Class 2: Script Basics](https://docs.nervos.org/docs/script-course/intro-to-script-2)
- [Intro to Script (overview)](https://docs.nervos.org/docs/script/intro-to-script)
- [Program Languages for Script](https://docs.nervos.org/docs/script/program-language-for-script)
- [Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock)
- [Run a Fiber Node](https://www.fiber.world/docs/quick-start/run-a-node)
- [Fiber basic transfer](https://docs.fiber.world/docs/quick-start/basic-transfer)
