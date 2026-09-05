# September Week 1 Report - CKBuilders Learning Journey

## Overview

This phase moved Fiber Pulse beyond payment confirmation inside its own interface and into merchant operations. The main deliverable is a settlement webhook outbox that can notify an external order system only after the receiving Fiber node confirms a signed invoice as paid.

The work also corrected a channel-lifecycle reporting issue discovered during the live two-node milestone. Failed channel negotiations were previously displayed as pending because unknown FNN states used a generic fallback. Fiber Pulse now exposes the failed state and its bounded failure explanation without counting it as spendable liquidity.

## Main Deliverables

| Area | Result |
|------|--------|
| Merchant integration | External order systems can receive confirmed Fiber settlement events |
| Authenticity | Every callback is signed with HMAC-SHA256 over its timestamp and exact body |
| Idempotency | Deterministic event IDs prevent duplicate order updates during repeated polling |
| Delivery reliability | Events are stored before delivery and retried with bounded exponential delay |
| Failure handling | Exhausted events enter a terminal failed state instead of retrying forever |
| Privacy | Encoded invoices, payment hashes, payee keys, preimages, RPC URLs, and node credentials are excluded |
| Transport policy | Production destinations are HTTPS-only and cannot contain URL credentials or fragments |
| Operator visibility | Merchant settlement UI reports disabled, pending, delivered, misconfigured, or failed callback state |
| Channel accuracy | Failed negotiations are no longer represented as pending channels |
| Transactional state | Cooldowns, grants, tracking, and callbacks share a SQLite WAL database |
| Background delivery | Separate worker retries callbacks without an open merchant browser |
| Concurrency control | Transactional leases prevent duplicate attempts across app and worker processes |
| Migration | Existing JSON records import automatically on first database access |

## Settlement Webhook Design

The merchant invoice watch already treated the receiving FNN as the settlement authority through `get_invoice`. I extended that boundary instead of allowing the browser to report payment success. A callback is considered only when the server-owned invoice watch returns a paid state.

The destination URL and signing secret are server configuration. The browser cannot select a callback host, provide a signing key, alter the event type, or submit an arbitrary payload. This avoids turning the API into a general outbound-request proxy.

Each event contains:

- a versioned `fiber.invoice.settled` event name;
- a deterministic event and idempotency identifier;
- a one-way invoice fingerprint;
- signed invoice amount and currency;
- the merchant description used for order correlation;
- paid status and first-observed timestamp.

The callback deliberately omits the complete invoice and operational Fiber identifiers. An order service can correlate and deduplicate settlement without gaining access to node internals.

## Authenticity And Replay Handling

Pulse signs `<timestamp>.<raw-body>` using HMAC-SHA256 and sends the signature in `x-fiber-pulse-signature`. Binding the timestamp and exact serialized body prevents either from being changed independently. The deterministic event ID is also sent as `idempotency-key` so receivers can safely return success for an event they have already processed.

The receiver contract now documents three required checks:

1. Recompute and compare the HMAC signature before parsing the event as trusted.
2. Apply an acceptable timestamp window according to the merchant's operational policy.
3. Deduplicate the order update using the idempotency key.

## Durable Delivery State

An event is written to the local outbox before the first network request. Successful deliveries become terminal and later invoice polls reuse that state without sending another callback. Unsuccessful deliveries retain their original payload and event ID, then become eligible after a bounded exponential delay.

The number of attempts, retry base, request timeout, and outbox path are operator-configurable within hard bounds. When the attempt ceiling is reached, the event becomes failed and polling does not send it again. The merchant card surfaces this outcome instead of silently losing the integration failure.

The outbox can now run through a transactional SQLite WAL database shared by Fiber Pulse and a separate worker on the same VPS. Retries continue without an open merchant browser. The remaining boundary is multi-host deployment, which requires a network database rather than a shared local volume.

## Transactional State Core

I introduced a common namespaced state layer for cooldown claims, payment grants, payment tracking, and settlement callbacks. Database mutations use `BEGIN IMMEDIATE`, atomic upserts, rollback on failure, WAL journaling, and a busy timeout. File mode remains available, while enabling `FIBER_STATE_DB_PATH` moves all four domains into one database.

The migration path preserves existing work: if a namespace has no database record yet, Pulse reads its current JSON file and commits that value on first access. This prevents enabling the stronger backend from silently invalidating grants or losing tracked payments.

## Independent Delivery Worker

The settlement worker scans due events in bounded batches. Before network delivery, it transactionally assigns a unique lease and expiry. Concurrent workers cannot claim the same active lease, and a crashed worker's lease eventually becomes recoverable. Final state can only be written by the process holding the matching lease identifier.

The proof exercises this across real processes: the initial app-side callback receives a temporary failure, then a separate worker process reads the same WAL database, claims the event, delivers it, and records the terminal result. The original process subsequently observes the delivered state without sending a duplicate.

## Channel Lifecycle Correction

The public Fiber snapshot now checks `failure_detail` before interpreting the state machine name. A channel carrying a failure is classified as failed even if its last state name was a funding negotiation state. The UI displays the bounded reason while liquidity calculations continue to include only ready, enabled, connected CKB channels.

This correction was derived from the abandoned channel proposal observed during the real payer-to-merchant test, where FNN retained the negotiation record with `Peer disconnected during channel opening`.

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm run build` | Pass; production UI and all dynamic API routes compiled |
| `pnpm run prove:fiber-security` | Pass; private RPC boundary and operator gates preserved |
| `pnpm run prove:fiber-grant` | Pass; one-shot authorization remains request and amount bound |
| `pnpm run prove:fiber-tracking` | Pass; durable payment reconciliation remains intact |
| `pnpm run prove:fiber-webhook` | Pass; signature, privacy, idempotency, retry, dead-letter, URL policy, and channel-state checks |
| `pnpm run prove:state-store` | Pass; rollback, cooldown serialization, one-time grants, payment tracking, and JSON import |
| Cross-process worker proof | Pass; separate process claimed and delivered a due callback through SQLite WAL |

## Outcomes

1. Connected confirmed Fiber settlement to a practical merchant order-processing interface.
2. Added cryptographic callback authenticity without exposing the FNN node or payment secrets.
3. Prevented duplicate fulfillment caused by repeated settlement polling.
4. Preserved failed deliveries for bounded retry and operator inspection.
5. Corrected stale channel records so operational status and liquidity are more accurate.
6. Added a deterministic proof that runs without moving testnet funds or requiring a live Fiber node.
7. Replaced independent file mutations with an optional transactional state core.
8. Decoupled webhook retries from merchant browser polling through a standalone worker.
9. Added expiring delivery leases for crash recovery and cross-process duplicate prevention.

## Next

1. Provide a small receiver example that verifies signatures and updates an example order atomically.
2. Add operator controls for inspecting and manually replaying failed webhook deliveries.
3. Add metrics for queue depth, oldest pending event, attempt count, and dead-letter totals.
4. Introduce a network database adapter before deploying multiple application hosts.

## References

- `fiber-pulse/lib/server/settlement-webhook.ts`
- `fiber-pulse/lib/server/state-store.ts`
- `fiber-pulse/scripts/settlement-webhook-worker.mjs`
- `fiber-pulse/app/api/fiber/invoice/route.ts`
- `fiber-pulse/scripts/prove-fiber-webhook.mjs`
- `fiber-pulse/docs/FIBER_LIVE_MODE.md`
