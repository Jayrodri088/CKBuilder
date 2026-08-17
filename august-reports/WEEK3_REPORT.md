# August Week 3 Report — CKBuilders Learning Journey

## Overview

This report covers work beginning **August 16, 2026**. Week 2 left Fiber Pulse able to parse a merchant invoice and pay it from the payer node, but the merchant still could not watch settlement, and live execution still meant typing the long-lived operator token on the payer screen.

I treated those as product gaps, not infra chores. The week’s work is in `fiber-pulse/`: merchant invoice watch, one-shot payment grants, and a file-backed limiter so cooldowns survive a process restart.

---

## What I shipped

| Piece | Purpose |
|--------|---------|
| Merchant settlement watch | Poll FNN `get_invoice` after sharing a signed invoice |
| One-shot pay grants | HMAC capability bound to request ID, amount, and invoice |
| Grant API | `POST /api/fiber/grant` — operator-gated issue only |
| Payer grant field | Execute once without holding the operator token |
| File-backed limiter | `.data/rate-limit.json` shared across Next restarts |
| Proofs | `prove:fiber-grant`, `prove:fiber-watch`, security regression for grant 403 |

---

## Merchant watch

Week 2 could tell the payer “this invoice is valid.” It could not tell the merchant “this invoice is paid.”

The invoice API now accepts `watch: true`. Pulse parses the signed invoice, then calls `get_invoice` with the full payment hash on the server-owned CLI. The UI shows `open` / `paid` / `cancelled` / `expired` and never returns the raw hash to the browser.

A fresh invoice on this node is expected to stay `open`. That is still useful: it proves the receiving node actually has the invoice. A two-node settle — invoice created on a separate merchant FNN, paid from this node, both records checked — is the remaining live test. I did not fake that on a single node.

---

## One-shot grants

Live execution still requires the server window (`FIBER_PAYMENT_EXECUTION_ENABLED`) and the operator token to *issue* a grant. The payer no longer needs that token.

A grant is `pls1.<payload>.<mac>`. It is bound to:

- payment request ID
- exact CKB amount
- invoice fingerprint (or empty for keysend)

The grant is checked before Fiber is contacted. It is consumed only after the node looks ready, so a binding mismatch does not burn the capability. Replay after a successful consume is rejected.

The long-lived operator token remains valid for the existing execution proofs.

---

## Shared limiter

Invoice validation, invoice watch, grant issue, and payment proof now write last-used timestamps to `.data/` instead of a module global. That survives `next start` restarts on this machine. It is not a multi-host store; I am not pretending it is.

---

## Verification

| Check | Result |
|--------|--------|
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm run build` | Pass; `/api/fiber/grant` is a dynamic route |
| `pnpm run prove:fiber-security` | Pass, including grant issue 403 |
| `pnpm run prove:fiber-grant` | Pass: issue, request/amount binding, fail-closed if Fiber is down |
| `pnpm run prove:fiber-watch` | Skips unless FNN is already running |

---

## Outcomes

1. Merchant can watch an invoice they just created, on the receiving node.
2. Payer can execute with a one-shot grant instead of the operator secret.
3. Cooldowns persist across a local process restart.
4. Two-node merchant settle is still the live Fiber test I have not claimed.

---

## August 17 Progress

I added merchant **cancel** for an open invoice. Cancel is operator-gated, uses the server-owned `cancel_invoice` CLI, then re-reads status so the watch panel can show `cancelled`. Recent Pulse requests that carry a signed invoice can reopen watch/cancel without recreating the share link.

This is still a single-node merchant control, not a two-node pay.

---

## Next

1. Run a two-node invoice: create on a receiving FNN, pay from this node, confirm watch flips to paid and the payer `get_payment` is Success.
2. Move the file limiter to shared storage before any multi-instance deploy.
3. Keep live stream execution off until per-tick grants exist.

---

## References

- [Fiber basic transfer](https://www.fiber.world/docs/quick-start/basic-transfer)
- [Run a Fiber node](https://www.fiber.world/docs/quick-start/run-a-node)
- `fiber-pulse/docs/FIBER_LIVE_MODE.md`
