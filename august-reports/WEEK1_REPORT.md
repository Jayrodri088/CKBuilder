# August Week 1 Report — CKBuilders Learning Journey

## Overview

This report covers the **start** of the August track (week of **August 4, 2026** and ongoing). The theme is moving from Fiber as a **read-only probe** (Pay Link Phase A) toward a **consumer payment product** with a real **dual-rail** story: Fiber when capacity allows, L1 hash-lock when it does not.

The week is **in progress** — not closed. Emphasis remains on learning outcomes and runnable artifacts, not a file listing.

---

## Context: Fiber builder initiative — Part 2

The July Fiber infrastructure sprint was **Part 1** (tools and SDKs). **Part 2** shifts to **product and consumer solutions** built on Fiber. August work aims at that product layer, continuing from Pay Link’s dual-rail story rather than starting a new infra toolkit.

Private pattern research from the Part 1 submission wave is kept **local and gitignored** (not listed in reports or the app).

---

## Fiber Pulse — consumer pay MVP (expanding)

`fiber-pulse/` is the August product lab: create → share → preflight → Fiber mock settle, with an L1 escape hatch into hash-lock addresses / Pay Link.

### What is working now

| Piece | Purpose |
|--------|---------|
| **Create / share / QR / countdown** | Self-contained `/?p=` pay links |
| **MOCK / LIVE badge + capacity strip** | Honest mock Fiber liquidity model |
| **Preflight + actionable fixes** | Block / warn before pay; plain-language next steps |
| **Session spend cap** | Browser budget for demo spends |
| **L1 rail (live)** | Switch to L1 → derive hash-lock address against OffCKB using synced Pay Link deployment |
| **L1 QR + payer URL** | Share lock address / open Pay Link payer view |
| **Fund check** | Poll lock balance every 10s; **Check now**; waiting / funded status |
| **Claim handoff** | **Open claim** → Pay Link claim tab prefilled (preimage, amount, address) |
| **Pay Link prefill** | create / payer / claim views accept `from=pulse` query params |
| **`prove:l1-live`** | RPC + cell-dep + address derivation proof (verified on live tip) |

### Live proof (this session)

With OffCKB up on `:28114`:

- Pay Link `preflight` passed (RPC + hash-lock cell dep live)
- `fiber-pulse` `prove:l1-live` passed — tip seen, cell dep live, lock address derived from a Pulse preimage

Fiber FNN (`:8227`) was still down — expected; LIVE Fiber probe remains optional.

### Design intent

- **Product, not probe UI**
- **Mock-first Fiber**, **live L1** when the node is up
- **Dual rail:** Fiber when capacity allows; L1 hash-lock otherwise

### Still open

- Real Fiber `new_invoice` / `send_payment` when FNN is up  
- Manual end-to-end fund + claim UI demo (faucet → fund lock → claim with preimage)  
- Mobile pay-sheet polish  

---

## How to run / test

```powershell
# terminal 1 — already running for you
offckb node

# terminal 2
cd d:\CKB\Test\fiber-pulse
pnpm run sync:deployment
pnpm run run:all
pnpm run prove:l1-live
pnpm run dev
```

1. Open http://127.0.0.1:3060  
2. Create a pay request → open as payer  
3. Force Fiber block (amount &gt; sendable) or click **Switch to L1 rail**  
4. Confirm a **lock address + QR** appear (live derive)  
5. Watch **Fund check** flip to **funded** after faucet/wallet send  
6. Run Pay Link (`cd ../ckb-pay-link; pnpm run dev`) → **Open claim** from Pulse  
7. Set receiver → Claim  

Stop Pulse/Pay Link with `Ctrl+C` when finished.

---

## Next

1. Real Fiber path when FNN is available  
2. UX polish (mobile sheet, clearer LIVE errors)  
3. Optional: in-app claim when CCC signer is available without leaving Pulse  
