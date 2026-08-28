# Fiber Pulse

Fiber Pulse is a consumer payment flow for CKB over Fiber: create a request, share a self-contained link or QR code, verify live node and channel readiness, and either prove or execute a bounded Fiber payment. When Fiber is unavailable, the request can hand off to the existing L1 hash-lock Pay Link flow.

## What works

- Invoice and budgeted stream requests in explicit mock mode
- Public, normalized Fiber node/channel snapshot with private RPC details hidden
- Live preflight based on sync state, peers, ready CKB channels, and outbound liquidity
- Bounded `fnn-cli send_payment --dry-run` route proof
- Operator-gated live keysend execution with a temporary bearer token
- Merchant-directed settlement with signed Fiber invoice validation
- Operator-gated signed invoice creation from the merchant UI
- Merchant invoice watch against the receiving FNN (`get_invoice`)
- One-shot HMAC payment grants so the payer never holds the operator token
- File-backed payment/invoice cooldowns that survive process restart
- Receipts that distinguish mock settlement, dry-run proof, and successful live settlement
- Durable opaque payment tracking for status recovery after a refresh or server restart
- L1 hash-lock fallback, funding monitor, and Pay Link claim handoff

Live stream execution is intentionally not enabled yet. Stream mode remains a mock product prototype; live mode currently supports invoice payments only.

## Run

```powershell
cd D:\CKB\Test\fiber-pulse
pnpm install
pnpm run run:all
pnpm run dev
```

Open http://127.0.0.1:3060.

## Verify

```powershell
pnpm exec tsc --noEmit
pnpm run build
pnpm run prove:fiber-security
pnpm run prove:fiber-grant
pnpm run prove:fiber-watch
pnpm run prove:fiber-tracking
pnpm run prove:fiber-live
pnpm run prove:l1-live
pnpm run prove:l1-fund-claim
```

The Fiber security proof boots the production build and verifies that the old arbitrary RPC proxy path is blocked, private RPC details are redacted, and the payment cap is enforced before execution.

With FNN running, `prove:fiber-live` discovers a ready CKB channel and runs a 0.01 CKB end-to-end dry-run through the production Fiber Pulse API. It saves a redacted local receipt to `artifacts/fiber-live-proof.json`; generated evidence is ignored by Git.

`prove:fiber-execution` is intentionally separate and moves exactly 0.01 testnet CKB. It creates an ephemeral operator token, restricts execution to testnet, waits for final payment status, and verifies the channel balance delta before passing.

`prove:fiber-invoice` creates a short-lived testnet invoice and proves that Pulse accepts its signed amount/currency/expiry, rejects amount substitution, and rejects a tampered signature without executing a payment.

`prove:fiber-grant` issues a one-shot grant with an operator token, proves it is bound to request ID and amount, and fails closed when Fiber is unreachable.

`prove:fiber-watch` creates an unpaid invoice and checks merchant watch. It skips if FNN is down.

`prove:fiber-tracking` boots the production build with an isolated tracker store and proves that a terminal payment can be recovered after restart, the full payment hash remains private, and invalid, unknown, and expired capabilities fail distinctly.

## Merchant invoice flow

1. In Pulse, select **Invoice**, enter the exact CKB amount and description, then create a signed invoice with the temporary operator token. An externally created `fibt...` invoice can still be pasted instead.
2. Pulse validates the signed amount, network, recipient, expiry, and signature against the receiving FNN.
3. Share the generated self-contained link or QR code.
4. On the merchant device, watch settlement and optionally issue a one-shot pay grant.
5. The payer enables live Fiber and runs a route proof, or pays with that grant.

The encoded invoice is intentionally shareable. The payment preimage and node secret key are not included in the Pulse link.

## Live Fiber

Copy `.env.example` to `.env.local` and configure the server-only FNN values. Do not use `NEXT_PUBLIC_` variables for RPC URLs, tokens, CLI paths, or target pubkeys.

On this Windows workstation, start the existing encrypted node without exposing its password:

```powershell
pnpm run start:fnn
```

Public UI users can run a bounded dry-run proof. Actual execution requires all of the following:

- `FIBER_PAYMENT_EXECUTION_ENABLED=true`
- A strong `FIBER_PAYMENT_EXECUTION_TOKEN`
- A trusted operator entering that token for the current action
- A configured target peer and sufficient ready-channel liquidity

Keep execution disabled outside a short trusted test window. See `docs/FIBER_LIVE_MODE.md`.

Executed payments receive a random 128-bit tracking capability. Pulse stores that opaque ID with the local request and keeps the full payment hash in `.data/payment-tracker.json` on the server. A payer can refresh the page and request the final status without receiving the private RPC URL or full hash. Tracking records expire after 24 hours by default; configure `FIBER_PAYMENT_TRACKING_TTL_MS` to change the retention window.

Treat the tracking ID as a short-lived read capability: do not place it in public logs or shared payment links.

## L1 fallback

With OffCKB and Pay Link running, Pulse derives the same hash-lock address, monitors funding, and opens the claim flow with the required fields. Current hash-lock cells need roughly 110 CKB of occupied capacity, plus room for change when partially claiming.

## Progress

August reports are stored in `../august-reports/`.
