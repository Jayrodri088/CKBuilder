# Fiber Pulse

Consumer-facing Fiber payment MVP for the August product track (week **in progress**).

Flow: **create → share (QR / self-contained link) → preflight → settle on Fiber**, with **L1 hash-lock handoff** into Pay Link when Fiber cannot complete.

## Run

```powershell
cd fiber-pulse
pnpm install
pnpm run run:all
pnpm run dev
```

Open http://127.0.0.1:3060 — stop with `Ctrl+C` when done.

## Test (OffCKB up)

```powershell
pnpm run sync:deployment
pnpm run prove:l1-live
pnpm run dev
```

1. Set a **session spend cap**.
2. Create a payment → open as payer.
3. **Switch to L1 rail** (or force a Fiber capacity block first).
4. Confirm **lock address + QR** (live derive against `:28114`).
5. Fund via OffCKB faucet → **Fund check** should show **funded**.
6. Start `ckb-pay-link` on `:3000` → **Open claim** (prefilled) → claim to receiver.
7. Or pay on Fiber mock → receipt + capacity/session updates.

Optional: `NEXT_PUBLIC_PAY_LINK_ORIGIN` (default `http://127.0.0.1:3000`), Fiber probe on `:8227`.

## Status

Expanding through the week. Notes: `../august-reports/WEEK1_REPORT.md`.
