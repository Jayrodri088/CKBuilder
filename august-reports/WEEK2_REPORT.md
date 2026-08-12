# August Week 2 Report - CKBuilders Learning Journey

## Overview

This report covers work beginning **August 11, 2026**. The focus was moving Fiber Pulse beyond a connectivity demo into a safer, channel-aware payment application. The week started with an audit of the existing Fiber integration and exposed an important problem: the browser-facing API could forward any caller-supplied JSON-RPC method to the private FNN endpoint.

I closed that boundary first, then implemented live channel preflight, bounded route proof, operator-gated testnet execution, and receipts that clearly distinguish simulated, dry-run, and settled outcomes.

## Main Deliverable

The work is in `fiber-pulse/`.

| Area | Week 2 result |
|------|---------------|
| FNN access | Replaced arbitrary RPC proxying with a fixed read-only snapshot |
| Live preflight | Uses sync state, peers, channel state, asset, and outbound liquidity |
| Payment proof | Runs bounded server-side `send_payment --dry-run` |
| Live execution | Disabled by default; requires server opt-in and operator bearer token |
| Receipts | Separates mock receipt, route proof, submitted payment, and successful settlement |
| UI | Shows live channel capacity and exposes execution only as a trusted operator action |
| Regression proof | Production-server test blocks old `send_payment` forwarding with HTTP 403 |

## Security Boundary

The original `/api/fiber` accepted `{ method, params }` and forwarded both fields to FNN. An unauthenticated browser could therefore request sensitive methods, including payment operations. The corrected design has two narrow endpoints:

1. `GET /api/fiber` performs only server-owned `node_info`, `list_channels`, and `list_peers` calls and returns normalized, redacted data.
2. `POST /api/fiber/payment` accepts only a validated request ID, CKB amount, and execution flag. The server owns the RPC URL, CLI path, target pubkey, fee ceiling, timeout, amount cap, and cooldown.

Live execution uses a constant-time bearer-token comparison and remains off unless `FIBER_PAYMENT_EXECUTION_ENABLED=true`. RPC URLs, target pubkeys, and secrets are never accepted from the browser and are not placed in `NEXT_PUBLIC_` environment variables.

## Channel-Aware Preflight

The old live check treated node reachability as a 92% payment pass even when channel capacity was unknown. The new preflight fails closed unless all required conditions are present:

- FNN is reachable.
- The node reports synced.
- At least one peer is connected.
- At least one CKB channel is `ChannelReady`/open.
- Ready outbound liquidity covers the invoice amount or stream tick.

When live mode is selected, a failed node check no longer silently falls back to mock. Mock mode remains available, but it is explicit.

## Payment Proof and Execution

For live invoices, the payer screen now offers a bounded route proof. This calls `fnn-cli payment send_payment` with keysend, a 15-second timeout, a 0.5% maximum fee rate, and `dry-run=true`. A successful proof produces a Fiber proof receipt but does not mark the request paid.

Actual testnet execution is a separate operator action. It requires a server feature flag and temporary token. The UI marks a request paid only when an executed Fiber response reports `SUCCESS`; an in-flight or ambiguous response remains unconfirmed.

Live stream execution is deliberately still disabled. Streaming remains in explicit mock mode until per-tick authorization, cancellation, and durable accounting are designed.

## Verification

Completed checks:

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | Pass after snapshot integration |
| `pnpm run build` | Pass; both Fiber API routes built as dynamic server routes |
| `pnpm run prove:fiber-security` | Pass, four boundary assertions |
| Arbitrary `send_payment` through `/api/fiber` | Rejected with HTTP 403 |
| Private RPC URL in public snapshot | Not exposed |
| Payment amount above 0.05 CKB | Rejected before FNN access |
| Live `/api/fiber` snapshot | Pass: testnet, ready channel, 400 CKB sendable, 151 CKB receivable |

The existing FNN key password was recovered from the prior local setup session without placing it in the project. FNN then started successfully with its existing identity and database, connected to Fiber peers, and exposed a public `ChannelReady` CKB channel. Fiber Pulse consumed that node through its normalized API and correctly reported testnet plus live channel liquidity. A real payment is still not claimed because the trusted payment target has not yet been configured and exercised.

## Operating Notes

I added `fiber-pulse/.env.example` and `fiber-pulse/docs/FIBER_LIVE_MODE.md`. They document server-only configuration, encrypted-key startup, dry-run testing, a short trusted execution window, token rotation, and the current single-instance rate-limit boundary.

## Outcomes

1. Removed a high-risk arbitrary FNN RPC forwarding path.
2. Replaced connectivity-only scoring with real channel and liquidity checks.
3. Added a verifiable dry-run route proof without misrepresenting it as settlement.
4. Added a narrowly gated path for real testnet keysend execution.
5. Preserved the existing L1 hash-lock fallback and explicit mock product flow.

## August 12 Progress

I completed the first real payment-path proof against the running FNN node. A new `pnpm run prove:fiber-live` command discovers the peer on a ready CKB channel, starts the production Fiber Pulse server with that server-owned target, and submits a 0.01 CKB dry run through the same `/api/fiber/payment` endpoint used by the UI.

The proof passed on testnet with one ready channel, returned FNN status `Created`, reported zero routing fee, produced a redacted payment hash, and asserted `settled: false`. This closes the gap between a live channel snapshot and a real FNN route-construction check while still guaranteeing that the automated proof cannot move funds. Redacted evidence is written locally to `fiber-pulse/artifacts/fiber-live-proof.json` and excluded from Git.

I then hardened and exercised the real execution path. Live execution is now restricted by the server to an allowed network (`testnet` by default), and the payment adapter polls `get_payment` until a terminal status rather than treating submission as settlement. A one-shot `prove:fiber-execution` command generates an ephemeral operator token and caps itself at 0.01 CKB.

The first execution passed with final status `Success`. The ready channel's local balance changed from **400 CKB to 399.99 CKB**, while its remote balance changed from **151 CKB to 151.01 CKB**. This independently confirms the 0.01 CKB transfer rather than relying only on the payment response. The UI now reads the server payment policy, shows whether the execution window is open, displays the proof cap and allowed network, and disables unsupported live actions.

## Next

1. Replace the in-memory cooldown with a shared limiter before multi-instance deployment.
2. Design signed, single-use payment capabilities before exposing execution beyond a trusted operator.
3. Add invoice-based settlement so merchants can receive without a server-fixed keysend target.

## References

- [Fiber basic transfer](https://www.fiber.world/docs/quick-start/basic-transfer)
- [Run a Fiber node](https://www.fiber.world/docs/quick-start/run-a-node)
- `fiber-pulse/docs/FIBER_LIVE_MODE.md`
