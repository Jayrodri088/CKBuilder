# June Week 2 Report - CKBuilders Learning Journey

## Overview

This report covers work completed from **June 9 to June 13, 2026**. The week moved through three layers of the CKB stack:

1. understanding when and how scripts execute,
2. building and testing native Rust scripts for CKB-VM,
3. reconstructing complete SUDT and Nervos DAO workflows as interactive, verifiable learning applications.

The main shift was from studying isolated script concepts to modeling full protocol lifecycles. Each topic was delivered with a runnable interface or command-line proof, so the result can be demonstrated and checked rather than existing only as notes.

---

## Script course lab: making the validation model executable

The week began by consolidating the first two CKB Script Course modules into `script-course-lab/`.

### Class 1: transaction validation

The validation model was represented as code that determines which scripts execute for a transaction:

- input lock scripts execute and are deduplicated by script identity,
- input and output type scripts execute and are also deduplicated,
- output lock scripts do not execute when their cells are created,
- one failing script invalidates the complete transaction.

This made the distinction between **creating a locked cell** and **spending a locked cell** concrete. It also connected earlier deployment problems to the correct validation stage: unresolved cell dependencies happen before CKB-VM execution, while lock and type script failures occur during transaction verification.

### Class 2: script code and script references

The second part builds a small `carrot` script into bytecode and verifies it with a mock transaction. It demonstrates that:

- a CKB `Script` is a reference containing `code_hash`, `hash_type`, and `args`,
- the executable program is stored separately as cell data,
- the program must be included through a cell dependency,
- script arguments configure an instance of the program,
- witnesses and transaction context provide runtime evidence.

The lab includes an optional live comparison against devnet, while the core validation and mock verification remain runnable offline.

**Verification entry point:**

```powershell
cd script-course-lab
pnpm run run:all
```

**Learning outcome:** the cell model is not just a storage abstraction. It determines how programs are referenced, grouped, and executed across a transaction.

---

## Rust script lab: moving from JavaScript-hosted scripts to native CKB-VM code

The next step was `rust-script-lab/`, based on the official CKB Rust Script Quick Start.

Two small contracts were implemented:

| Contract | Purpose |
|----------|---------|
| `hello-world` | Runs inside CKB-VM and writes a debug message through `ckb_std::debug!` |
| `simple-print-args` | Loads the current script and reads its `args` field |

The scripts compile for the `riscv64imac-unknown-none-elf` target and are exercised in two ways:

- direct execution through `ckb-debugger`,
- transaction-level tests through `ckb-testtool`.

### Windows toolchain work

The lab includes PowerShell automation for building and testing on Windows. Important environment requirements were made explicit:

- Rust stable with the RISC-V target,
- a local `ckb-debugger` binary,
- MSYS2 MinGW GCC for crates used by `ckb-testtool`,
- no live CKB node or devnet required.

The full process is wrapped by:

```powershell
cd rust-script-lab
pnpm run run:all
```

This checks the debugger, builds release binaries, runs the Hello World script directly, and executes the Rust test suite.

**Learning outcome:** script development can be tested at multiple levels. `ckb-debugger` proves that the binary executes, while `ckb-testtool` proves how it behaves inside a transaction-shaped environment.

---

## SUDT Operations Lab: reconstructing token movement through cells

The historical `ckb-cli` SUDT operations tutorial was rebuilt as `sudt-operations-lab/`, an interactive browser application backed by a deterministic accounting model.

The lab demonstrates the complete lifecycle:

1. create an empty Anyone-Can-Pay cell,
2. issue SUDT into a cheque,
3. claim the cheque into an ACP cell,
4. transfer directly between ACP cells,
5. issue additional supply,
6. create a receiver-specific cheque,
7. claim a cheque immediately,
8. leave a cheque unclaimed,
9. advance six epochs,
10. refund the expired cheque to its sender.

### Important protocol concepts

- The **SUDT type script** controls token issuance and supply conservation.
- The **lock script** controls who may consume each token cell.
- Anyone-Can-Pay allows value to be added without the receiver signing.
- A cheque allows the receiver to claim immediately.
- The cheque sender receives a refund path after the timeout.
- Transfers change cell ownership and data, but do not change total issued supply.

The UI retains equivalent historical `ckb-cli` commands while clearly labeling the workflow as educational rather than current production deployment guidance.

### Accounting proof

The proof executes the complete tutorial and checks every state transition against the supply invariant:

```text
Issued: 2300 SUDT
Alice: 1200 SUDT
Bob: 1100 SUDT
Pending cheques: 0
Elapsed time: 6 epochs
```

**Verification entry point:**

```powershell
cd sudt-operations-lab
npm run run:all
```

**Learning outcome:** fungible tokens on CKB are not account balances stored in a contract. They are amounts encoded in live cells, with type scripts preserving supply and lock scripts providing different payment behaviors.

---

## DAO Observatory: connecting wallet UX to the system script

The final project of the week was `dao-observatory/`, inspired by the NervDAO application and grounded in the canonical `dao.c` implementation from `ckb-system-scripts`.

Instead of reproducing only a deposit form, the application exposes the complete protocol state machine:

```text
Wallet -> Deposited -> Withdrawing -> Withdrawn
```

### Deposit phase

A deposit creates a cell with:

- the Nervos DAO type script,
- empty script arguments,
- eight zero bytes in cell data,
- enough capacity to cover the cell's occupied storage.

The simulator separates occupied capacity from the capacity eligible for compensation.

### Phase-one redemption

Redeeming does not immediately return liquid CKB. It consumes the deposit cell and creates a withdrawing cell:

- at the same output index,
- with the same capacity,
- with the original deposit block number stored as an eight-byte little-endian value.

The withdrawal header fixes the DAO accumulate rate used for compensation. This means compensation **stops increasing when phase one is committed**, even if the cell must continue waiting for maturity.

### Maturity and final withdrawal

The claim epoch is rounded to a 180-epoch checkpoint measured from the original deposit epoch. Final withdrawal requires:

- the deposit and withdrawal headers,
- the correct deposit header index in the witness,
- an absolute epoch `since` value,
- a chain epoch at or beyond the calculated checkpoint,
- outputs that do not exceed the script-calculated maximum withdrawal capacity.

The application surfaces these checks as live `dao.c` validation gates rather than hiding them behind a wallet button.

### Compensation formula

The modeled formula follows the system script:

```text
maximum withdrawal =
  occupied capacity
  + (original capacity - occupied capacity)
    * withdrawal AR / deposit AR
```

The deterministic proof deposits 10,000 CKB, initiates redemption at epoch 1170, rounds the claim epoch to 1180, freezes compensation at `21.51346118 CKB`, and rejects final release until the maturity condition is reached.

**Verification entry point:**

```powershell
cd dao-observatory
npm run run:all
```

**Learning outcome:** the Nervos DAO is a two-transaction protocol enforced by cell data, header dependencies, epoch locks, and capacity accounting. The wallet interface is only the top layer of that mechanism.

---

## How the week fits together

| Layer | Deliverable | Main lesson |
|-------|-------------|-------------|
| Validation model | `script-course-lab` | Which lock and type scripts execute |
| Native script development | `rust-script-lab` | Building and testing RISC-V scripts |
| Token protocol | `sudt-operations-lab` | Supply conservation across ACP and cheque cells |
| Monetary protocol | `dao-observatory` | Header-based compensation and epoch-locked withdrawal |

The projects form a progression:

- The script course explains the execution rules.
- The Rust lab places real code inside those rules.
- The SUDT lab shows a type script coordinating token cells.
- The DAO lab shows a system type script using headers, cell data, and `since` to enforce monetary policy.

---

## Consolidated outcomes

1. **Validation literacy:** lock scripts, type scripts, script grouping, and output-lock behavior are represented as runnable checks.
2. **CKB-VM literacy:** Rust contracts can be compiled for RISC-V and tested without a live chain.
3. **Token literacy:** SUDT supply remains conserved while ACP and cheque locks provide different transfer semantics.
4. **DAO literacy:** redemption is a two-phase process, compensation freezes at phase one, and maturity is enforced through absolute epoch `since`.
5. **Teaching-tool discipline:** complex protocol documentation was converted into interactive applications backed by deterministic proofs.
6. **Windows reliability:** repeatable PowerShell entry points document the debugger, compiler, and test-tool requirements.

---

## Next steps

- Connect selected simulations to an OffCKB devnet while preserving the offline proof mode.
- Compare the historical SUDT workflow with current xUDT tooling and extension capabilities.
- Add transaction serialization views showing the exact inputs, outputs, witnesses, header dependencies, and `since` values.
- Continue the script course with more complex type-script validation and contract testing.
- Add focused tests for invalid SUDT and DAO transitions, not only successful lifecycle proofs.

---

## References

- [CKB Script Course: Validation Model](https://docs.nervos.org/docs/script-course/intro-to-script-1)
- [CKB Script Course: Script Basics](https://docs.nervos.org/docs/script-course/intro-to-script-2)
- [CKB Rust Script Quick Start](https://docs.nervos.org/docs/script/rust/rust-quick-start)
- [CKB CLI SUDT Operations Tutorial](https://github.com/nervosnetwork/ckb-cli/wiki/UDT-%28sudt%29-Operations-Tutorial)
- [RFC 0025: Simple UDT](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md)
- [RFC 0026: Anyone Can Pay](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0026-anyone-can-pay/0026-anyone-can-pay.md)
- [RFC 0038: CKB Cheque Lock](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0038-ckb-cheque-lock/0038-ckb-cheque-lock.md)
- [NervDAO](https://github.com/ckb-devrel/nervdao)
- [Nervos DAO system script](https://github.com/nervosnetwork/ckb-system-scripts/blob/master/c/dao.c)
- [RFC 0023: DAO Deposit and Withdraw](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md)
