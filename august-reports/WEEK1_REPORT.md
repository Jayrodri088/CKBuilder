# August Week 1 Report — CKBuilders Learning Journey

## Overview

This report covers the **start** of the August track (week of **August 4, 2026** and ongoing). The theme is moving from Fiber as a **read-only probe** (Pay Link Phase A) toward a **consumer payment product** with a real **dual-rail** story: Fiber when capacity allows, L1 hash-lock handoff when it does not.

The week is **in progress** — not closed. Emphasis remains on learning outcomes and runnable artifacts, not a file listing.

**Today’s check:** Fiber RPC (`:8227`) and OffCKB (`:28114`) were both unreachable, so work focused on product rails that stay demoable offline (mock Fiber + L1 handoff into Pay Link).

---

## Context: Fiber builder initiative — Part 2

The July Fiber infrastructure sprint was **Part 1** (tools and SDKs). **Part 2** shifts to **product and consumer solutions** built on Fiber. August work aims at that product layer, continuing from Pay Link’s dual-rail story rather than starting a new infra toolkit.

Private pattern research from the Part 1 submission wave is kept **local and gitignored** (not listed in reports or the app). The product must earn recognition on its own UX and clarity.

---

## Fiber Pulse — consumer pay MVP (mock-first, expanding)

`fiber-pulse/` is the August product lab: create → share → preflight → pay, with settle timing in milliseconds.

### What is working now

| Piece | Purpose |
|--------|---------|
| **Create request** | Label + amount; invoice or budgeted stream mode |
| **Self-contained share link** | `/?p=<payload>` encodes amount/label/expiry — payer need not share the creator’s localStorage |
| **QR + countdown** | Scan/share UX; expiry visible on the pay sheet |
| **MOCK / LIVE badge** | Always visible; live only when Fiber RPC probe succeeds |
| **Channel capacity strip** | Send vs receive bars; per-channel liquidity; spends update mock balances |
| **Preflight** | Score + reasons from mock outbound capacity (blocks if insufficient) |
| **Actionable fixes** | Plain-language “what to do next” when preflight is medium/blocked |
| **Mock settle + receipt** | Measured ms settle; receipt id after pay |
| **Session spend cap** | Browser budget; pays stop when remaining cap is insufficient |
| **L1 rail handoff** | Switch to L1 → merchant preimage + deep link into Pay Link create (prefilled) |
| **Pay Link prefill** | `ckb-pay-link` accepts `from=pulse` query params for amount/label/preimage |
| **`/api/fiber` proxy** | Same pattern as Pay Link for optional FNN on `:8227` |
| **Proofs** | Codec + L1 handoff URL proofs in `pnpm run run:all` |

### Design intent

- **Product, not probe UI:** brand-first pay experience, not an operator dashboard.
- **Mock-first:** demos and learning do not depend on FNN being installed.
- **Honest mode:** MOCK vs LIVE is never hidden.
- **Liquidity-aware preflight:** amount must fit mock outbound capacity.
- **Dual rail:** Fiber first; L1 hash-lock via Pay Link when Fiber cannot complete.

### Still open this week / next days

- Real Fiber `new_invoice` / `send_payment` when FNN is up  
- End-to-end L1 fund/claim while OffCKB + hash-lock deployment are running  
- Stronger mobile pay-sheet polish  
- Optional: richer failure taxonomy tied to live RPC errors  

**Learning outcome:** Part 2 is a **consumer flow** with preflight, capacity, QR, session budget, and a concrete L1 escape hatch — not only a Fiber mock.

---

## How this fits the arc

| Layer | Prior | August Week 1 (in progress) |
|--------|--------|------------------------------|
| **Product** | Pay Link L1 + Fiber probe tab | Pulse create/pay + capacity + QR + L1 handoff |
| **Fiber** | Read-only `node_info` / channels | Mock settle + capacity + optional live probe |
| **L1** | Pay Link hash-lock MVP | Prefill handoff from Pulse when Fiber blocks |
| **Reports** | `june-reports/` | `august-reports/` Week 1 (open) |

---

## How to run / test

```powershell
cd fiber-pulse
pnpm install
pnpm run run:all
pnpm run dev
```

1. Open http://127.0.0.1:3060  
2. Set a **session spend cap** (e.g. 5 CKB)  
3. Create a payment → QR / **Open as payer**  
4. Confirm preflight; try an amount larger than sendable → fixes + **Switch to L1 rail**  
5. On L1 handoff: copy preimage → **Open Pay Link** (needs `ckb-pay-link` on `:3000` for the UI; CKB only needed to derive/fund)  
6. Or **Pay now** on Fiber mock → settle ms + receipt; capacity + session remaining update  
7. Optional: `pnpm run check:fiber` if FNN is on `:8227`

Stop the dev server when finished (`Ctrl+C`) so nothing is left running.

---

## Next (rest of this week)

1. Real Fiber invoice path behind the same pay sheet (when FNN is available)  
2. Live L1 fund/claim demo through the handoff with OffCKB up  
3. UX polish (mobile sheet, clearer LIVE errors)  
