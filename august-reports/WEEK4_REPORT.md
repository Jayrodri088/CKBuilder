# August Week 4 Report - CKBuilders Learning Journey

## Overview

This phase focused on payment reliability after submission. Fiber Pulse could execute a bounded payment and wait briefly for FNN to return a final state, but an in-flight response became difficult to recover after a browser refresh. The payer retained only a redacted receipt, while the full payment hash required for `get_payment` was intentionally unavailable to the browser.

I closed that gap with durable, capability-based payment reconciliation. The implementation preserves the private FNN boundary while giving the payer a safe way to recover a final success or failure state.

## Main Deliverable

| Area | Result |
|------|--------|
| Payment tracking | Random 128-bit capability generated for executed payments |
| Durable state | Server-side tracker survives application restarts |
| Reconciliation | Non-terminal payments refresh through server-owned `get_payment` |
| Privacy | Full payment hash and RPC configuration remain server-side |
| Payer recovery | Tracking status persists with the local payment request |
| Failure handling | Terminal `FAILED` responses remain inspectable instead of collapsing into a generic error |
| Regression proof | Production-build proof covers persistence, redaction, expiry, and invalid capabilities |
| Two-node settlement | Independently keyed payer and merchant FNNs settled a signed invoice |

## Problem Identified

Fiber payment submission and payment settlement are separate events. A payment may initially return `Created` while routing and settlement continue. The existing adapter polled for a bounded period, but a response that remained non-terminal had two weaknesses:

1. Refreshing the browser removed the transient receipt state.
2. Returning the full payment hash would unnecessarily expose operational data and weaken the server-owned FNN boundary.

The same issue applied to a terminal failure carrying a valid payment hash. The adapter registered the FNN error as a generic API failure, which prevented the payer from retaining a durable record of what happened.

## Capability-Based Tracker

I added a server-side payment tracker in `lib/server/payment-tracker.ts`. After FNN returns a payment hash for an executed payment, Pulse creates a cryptographically random tracking ID and stores a bounded record containing:

- the full payment hash;
- payment request binding;
- exact CKB amount;
- current FNN status and fee;
- creation, update, and expiry timestamps.

Only the opaque tracking ID is returned to the browser. A tracking request cannot select an RPC URL, FNN method, or payment hash. This keeps reconciliation inside the same narrow trust boundary as payment execution.

The local store is capped at 500 records and removes expired entries during new writes. The default retention window is 24 hours and can be configured by the operator.

## Status Reconciliation

The payment API now accepts a tracking capability as a separate operation. Its behavior is deliberately explicit:

- malformed capability: HTTP 400;
- unknown capability: HTTP 404;
- expired capability: HTTP 410;
- terminal record: return the stored redacted receipt;
- non-terminal record: call server-owned `get_payment`, update storage, and return the new redacted state.

Terminal `Success` marks the local request paid. Terminal `Failed` marks it failed and allows the user to understand the outcome before authorizing a separate retry. A failed payment with a valid hash no longer disappears behind a generic command error.

## Payer Experience

The payer view now includes a durable payment-status panel after live execution. It shows the current FNN status, a shortened opaque tracking reference, automatically checks non-terminal payments at a conservative interval while open, and retains a **Check final status** action as a manual fallback.

The tracking ID is saved with the local request, so reopening the same request on that device restores the reconciliation control. The panel explains that the capability does not reveal the private node endpoint or full payment hash.

## Security Properties

1. Tracking IDs contain 128 bits of randomness and are not derived from payment data.
2. Full payment hashes are stored only in the server-side `.data` directory.
3. Public responses expose only a redacted hash and request-bound status data.
4. Tracking has a separate cooldown and finite retention window.
5. Expired and unknown records do not trigger arbitrary FNN calls.
6. The browser cannot provide a target payment hash or RPC method.

The file-backed tracker is intentionally documented as single-instance infrastructure. Horizontal deployment still requires a transactional shared store, stronger distributed rate limiting, and deployment-level storage controls.

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm run build` | Pass; production routes and UI compiled |
| `pnpm run prove:fiber-tracking` | Pass; restart recovery, redaction, invalid/unknown/expired handling |
| `pnpm run prove:fiber-security` | Pass; RPC, amount, grant, invoice-create, and invoice-cancel boundaries |
| `pnpm run prove:fiber-grant` | Pass; operator issue, request/amount binding, fail-closed execution |
| Secure FNN startup | Pass; the DPAPI-protected credential was recovered without exposing the password |
| Merchant funding | Pass; bounded helper funded only the verified testnet merchant address |
| Two-node channel | Pass; both payer and merchant reported the same `ChannelReady` outpoint |
| `pnpm run prove:fiber-two-node` | Pass; 0.01 CKB settled and tracking survived an app restart |
| Independent settlement check | Pass; payer reported `Success`, merchant invoice reported `Paid`, and channel balances changed by the exact amount |

## Outcomes

1. Converted transient payment submission into a recoverable lifecycle.
2. Preserved the private FNN boundary while enabling payer-controlled status checks.
3. Made terminal payment failures durable and distinguishable from infrastructure errors.
4. Added a production-build proof that does not require moving testnet funds.
5. Established the storage contract needed for a later shared database implementation.
6. Completed the pending real two-node milestone with distinct node keys, on-chain channel funding, signed invoice execution, and independent recipient verification.

## Next

1. Replace file-backed tracking and cooldown state with a transactional shared store before multi-instance deployment.
2. Add automated recovery coverage for temporary peer or RPC interruption during an in-flight payment.
3. Add merchant-side reconciliation callbacks so external order systems can consume verified settlement state.

## References

- [Fiber basic transfer](https://www.fiber.world/docs/quick-start/basic-transfer)
- [Run a Fiber node](https://www.fiber.world/docs/quick-start/run-a-node)
- `fiber-pulse/docs/FIBER_LIVE_MODE.md`
