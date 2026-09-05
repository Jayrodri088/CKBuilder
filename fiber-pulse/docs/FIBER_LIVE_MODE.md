# Fiber Pulse Live Mode

## Security model

The browser never chooses an FNN RPC URL, JSON-RPC method, fee policy, or CLI executable. `/api/fiber` exposes a fixed read-only snapshot. `/api/fiber/payment` accepts only a request ID, bounded CKB amount, execution flag, and optionally a signed merchant invoice.

`/api/fiber/invoice` parses merchant invoices through the server-owned FNN CLI and returns only a redacted summary. The payment endpoint parses the invoice again immediately before use and requires its signed currency, exact amount, and expiry to match the live network and payment request.

Dry-run proof is rate-limited in process and capped by `FIBER_PAYMENT_MAX_CKB`. Live execution additionally requires a server opt-in and a matching bearer token. The target peer remains server-configured.

## Configure

Create `.env.local` from `.env.example`:

```dotenv
FIBER_RPC_URL=http://127.0.0.1:8227
FNN_CLI_PATH=D:\CKB\fiber-bin\fnn-cli.exe
FIBER_PAYMENT_TARGET_PUBKEY=<trusted-testnet-peer-pubkey>
FIBER_PAYMENT_MAX_CKB=0.05
FIBER_PAYMENT_COOLDOWN_MS=30000
FIBER_PAYMENT_ALLOWED_NETWORK=testnet
FIBER_INVOICE_PAYMENTS_ENABLED=true
FIBER_INVOICE_VALIDATION_COOLDOWN_MS=750
FIBER_PAYMENT_EXECUTION_ENABLED=false
FIBER_PAYMENT_EXECUTION_TOKEN=<long-random-operator-secret>
```

If FNN RPC authentication is enabled, also set `FNN_AUTH_TOKEN`.

## Start FNN

On this workstation, the node password is stored as a Windows DPAPI-protected `SecureString` in the gitignored `.secrets` directory. Start the node without typing or exposing it:

```powershell
pnpm run start:fnn
```

The encrypted credential can only be decrypted by the same Windows account on this machine. It must not be copied to a VPS as a portable secret.

For a fresh workstation without the local encrypted credential, set the password interactively:

The existing node uses an encrypted secret key, so set its password only in the process environment:

```powershell
$env:FIBER_SECRET_KEY_PASSWORD = Read-Host "Fiber key password" -MaskInput
Start-Process `
  -FilePath "D:\CKB\fiber-bin\fnn.exe" `
  -ArgumentList @("--config", "D:\CKB\fiber-node\config.yml", "--dir", "D:\CKB\fiber-node") `
  -WorkingDirectory "D:\CKB\fiber-node" `
  -WindowStyle Hidden
```

Confirm the node:

```powershell
D:\CKB\fiber-bin\fnn-cli.exe info node_info --url http://127.0.0.1:8227
D:\CKB\fiber-bin\fnn-cli.exe peer list_peers --url http://127.0.0.1:8227
D:\CKB\fiber-bin\fnn-cli.exe channel list_channels --url http://127.0.0.1:8227
```

Build and prove the live API without moving funds:

```powershell
pnpm run build
pnpm run prove:fiber-live
```

The proof discovers a ready CKB channel instead of accepting a target from the browser. It runs a capped 0.01 CKB dry run through `/api/fiber/payment`, asserts that the receipt is not settled, and writes redacted local evidence to `artifacts/fiber-live-proof.json`.

Pulse counts channel liquidity only when that channel is ready, enabled, and its actual channel peer appears in `list_peers`. A bootnode connection does not make an offline channel routable.

## Test flow

1. Start FNN and Fiber Pulse.
2. Create an invoice no larger than the configured proof cap.
3. Open the payer view and enable live Fiber.
4. Confirm preflight reports a synced node, peers, ready CKB channels, and sufficient sendable liquidity.
5. Leave operator execution off and run the live route proof.
6. Confirm the result is labelled `dry-run` and the request is not marked paid.
7. During a trusted testnet window, enable execution on the server, restart Pulse, select operator execution, and enter the temporary token.
8. Execute the payment. Treat it as paid only when the receipt reports `SUCCESS`.
9. Disable execution and rotate the operator token after the window.

## Merchant invoices

Create the invoice on the receiving merchant node, not the payer node:

```powershell
fnn-cli invoice new_invoice `
  --url http://MERCHANT_FNN:8227 `
  --amount 1000000 `
  --currency Fibt `
  --description "Order 1042" `
  --expiry 600
```

The amount is in shannons, so `1000000` is `0.01 CKB`. Paste the returned `invoice_address` into the Pulse merchant form and use the same CKB amount. The merchant RPC remains private; only the signed invoice is shared.

Run the non-settling policy proof:

```powershell
pnpm run prove:fiber-invoice
```

For the bounded local execution proof:

```powershell
pnpm run prove:fiber-execution
```

This command moves 0.01 testnet CKB. It discovers the ready channel target, generates an in-memory operator token, enables execution only in its temporary server process, requires final `Success`, verifies local and remote channel balance changes, and then closes the execution process. Evidence is written to `artifacts/fiber-live-execution.json` and ignored by Git.

## Current boundary

Cooldown state is durable in `.data/`. Configure `FIBER_STATE_DB_PATH` to place cooldowns in the shared SQLite state database described below.

Live execution can use a one-shot payment grant instead of putting the operator token on the payer device. The merchant issues `pls1.` grants from the create screen; each grant is HMAC-signed and bound to request ID, amount, and invoice fingerprint. The payer spends it once.

## Merchant settlement watch

After sharing a signed invoice, Pulse polls `get_invoice` on the receiving FNN and shows `open` / `paid` / `cancelled` / `expired`. This is the merchant-side counterpart to payer execution. For a true two-node settlement, create the invoice on a separate receiving node as demonstrated below.

The merchant screen can also call `new_invoice` through the narrow server API. Creation requires the operator token, accepts only a positive CKB amount, a bounded description, and an expiry from 60 seconds to 24 hours. Pulse derives the invoice currency from the active node network and returns only the signed invoice plus its redacted summary.

## Two-node settlement proof

The live proof uses independently keyed payer and merchant FNNs with a ready testnet channel. Create a fresh invoice on the merchant, then provide it to the proof process without saving it in a tracked environment file:

```powershell
$env:FIBER_MERCHANT_INVOICE = Read-Host "Fresh merchant invoice"
try {
  pnpm run prove:fiber-two-node
} finally {
  Remove-Item Env:FIBER_MERCHANT_INVOICE -ErrorAction SilentlyContinue
}
```

The runner creates an ephemeral operator token, restricts execution to testnet and 0.05 CKB or less, submits the invoice through `/api/fiber/payment`, requires final `Success`, restarts Pulse, and resolves the durable tracking capability again. Confirm independently on the merchant with `invoice get_invoice`; its status must be `Paid`, and the merchant channel balance must increase by the invoice amount.

For an isolated testnet merchant that must contribute funding capacity, this workstation includes a secure DPAPI-backed helper:

```powershell
pnpm run fund:merchant -- -Address <merchant-ckt-address> -Amount 200
pnpm run fund:merchant -- -Address <merchant-ckt-address> -Amount 200 -Broadcast
```

The first command is a dry run. The second broadcasts only after the helper verifies the encrypted key belongs to the expected payer lock, the recipient uses the `ckt` testnet prefix, and the amount is no more than 300 CKB. The password and decrypted private key are never printed or written by the helper.

## Durable payment reconciliation

When an executed payment returns a payment hash, Pulse immediately creates a random tracking capability before waiting for final settlement. The full payment hash stays in `.data/payment-tracker.json`; the browser stores only the opaque tracking ID and a redacted receipt. This lets the payer refresh and later reconcile `Created` or in-flight payments through the same narrow payment API.

Tracking records expire after `FIBER_PAYMENT_TRACKING_TTL_MS` (24 hours by default), are capped to 500 records, and return distinct invalid, missing, and expired responses. Terminal `Success` and `Failed` records can be read without contacting FNN again. Non-terminal records query server-owned `get_payment`. File mode supports one application process; SQLite mode safely coordinates processes on the same host.

The tracking ID is a short-lived bearer capability for reading that payment's status. Pulse deliberately excludes it from share-link encoding; operators should also exclude it from public logs and analytics payloads.

## Settlement webhooks

A merchant deployment can notify its order system when the receiving FNN confirms an invoice as paid:

```dotenv
FIBER_SETTLEMENT_WEBHOOK_URL=https://merchant.example.com/hooks/fiber
FIBER_SETTLEMENT_WEBHOOK_SECRET=<at-least-32-random-characters>
```

The destination is fixed by the server and must use HTTPS. HTTP is accepted only for an explicitly enabled loopback test receiver. Pulse sends `fiber.invoice.settled` with a deterministic event ID, invoice fingerprint, amount, currency, description, and observation time. It does not send the encoded invoice, payment hash, payee key, preimage, FNN RPC URL, or node credentials.

Consumers must verify `x-fiber-pulse-signature`, which is HMAC-SHA256 over `<x-fiber-pulse-timestamp>.<raw-request-body>`, and deduplicate on `idempotency-key`. Pulse records an event before delivery, suppresses callbacks already marked delivered, and retries unsuccessful responses with bounded exponential delay. Delivery state is shown in the merchant settlement card.

## Transactional state and worker

On Node 22.6 or newer, enable the shared on-host state database:

```dotenv
FIBER_STATE_DB_PATH=.data/fiber-pulse.sqlite
FIBER_SETTLEMENT_WORKER_INTERVAL_MS=5000
FIBER_SETTLEMENT_WORKER_BATCH_SIZE=20
```

The database runs in WAL mode with `BEGIN IMMEDIATE` mutations and a busy timeout. Cooldowns, one-shot grants, payment tracking, and the settlement outbox use the same namespaced state table. Existing JSON state is imported on first access, so enabling the database does not discard active local records.

Run callback delivery independently from the browser and Next.js request lifecycle:

```powershell
pnpm run worker:webhooks
```

The worker claims due events with a transactional lease before sending them. Another app or worker process observes the lease and cannot issue the same attempt. Expired leases can be recovered after a crashed worker, while only the lease owner can finalize delivery state.

Run the worker with the same environment and persistent `.data` volume as Fiber Pulse. SQLite WAL supports multiple processes on one VPS; it is not a multi-host coordination layer. A horizontally distributed deployment should replace this adapter with PostgreSQL or another networked transactional database while preserving the lease and idempotency contract.
