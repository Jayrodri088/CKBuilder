# Fiber Pulse

Fiber Pulse is a consumer payment flow for CKB over Fiber: create a request, share a self-contained link or QR code, verify live node and channel readiness, and either prove or execute a bounded Fiber payment. When Fiber is unavailable, the request can hand off to the existing L1 hash-lock Pay Link flow.

## What works

- Invoice and budgeted stream requests in explicit mock mode
- Public, normalized Fiber node/channel snapshot with private RPC details hidden
- Live preflight based on sync state, peers, ready CKB channels, and outbound liquidity
- Bounded `fnn-cli send_payment --dry-run` route proof
- Operator-gated live keysend execution with a temporary bearer token
- Receipts that distinguish mock settlement, dry-run proof, and successful live settlement
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
pnpm run prove:l1-live
pnpm run prove:l1-fund-claim
```

The Fiber security proof boots the production build and verifies that the old arbitrary RPC proxy path is blocked, private RPC details are redacted, and the payment cap is enforced before execution.

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

## L1 fallback

With OffCKB and Pay Link running, Pulse derives the same hash-lock address, monitors funding, and opens the claim flow with the required fields. Current hash-lock cells need roughly 110 CKB of occupied capacity, plus room for change when partially claiming.

## Progress

August reports are stored in `../august-reports/`.
