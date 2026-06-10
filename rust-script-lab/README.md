# rust-script-lab

Runnable lab for the [CKB Rust Quick Start](https://docs.nervos.org/docs/script/rust/rust-quick-start).

## Contracts

| Crate | Lesson |
|-------|--------|
| `contracts/hello-world` | `ckb_std::debug!("Hello World!")` |
| `contracts/simple-print-args` | `load_script()` and print lock args |

## Prerequisites

- Rust stable (≥1.95) + `riscv64imac-unknown-none-elf` target (`rustup target add riscv64imac-unknown-none-elf`)
- `ckb-debugger` from `../simple-lock/tools/ckb-debugger/v1.1.1/` (or set `CKB_DEBUGGER_BIN`)
- No Clang required (`ckb-std` without `libc`; `molecule` patched with `bytes_vec` for CKB-VM)
- MSYS2 `mingw64` gcc on PATH for `ckb-testtool` tests (`C:\msys64\mingw64\bin`)

No devnet required — builds and tests run offline.

## Run

```powershell
cd rust-script-lab
pnpm run run:all
```

Or step by step:

```powershell
pnpm run build
..\simple-lock\tools\ckb-debugger\v1.1.1\ckb-debugger.exe --bin build\release\hello-world
pnpm run test
```

On Linux/macOS with `make` installed, the upstream `Makefile` also works:

```bash
make build
make test CARGO_ARGS="-- --nocapture"
```
