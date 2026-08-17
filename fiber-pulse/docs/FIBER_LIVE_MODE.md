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

The in-memory cooldown is replaced by a file-backed limiter in `.data/`. That is enough for a local or single-machine restart. A public multi-instance deployment should still move the limiter onto shared storage.

Live execution can use a one-shot payment grant instead of putting the operator token on the payer device. The merchant issues `pls1.` grants from the create screen; each grant is HMAC-signed and bound to request ID, amount, and invoice fingerprint. The payer spends it once.

## Merchant settlement watch

After sharing a signed invoice, Pulse polls `get_invoice` on the receiving FNN and shows `open` / `paid` / `cancelled` / `expired`. This is the merchant-side counterpart to payer execution. A true two-node settle still needs the invoice created on a separate receiving node.
