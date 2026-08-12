# Fiber Pulse Live Mode

## Security model

The browser never chooses an FNN RPC URL, JSON-RPC method, target pubkey, fee policy, or CLI executable. `/api/fiber` exposes a fixed read-only snapshot. `/api/fiber/payment` accepts only a request ID, bounded CKB amount, and an execution flag.

Dry-run proof is rate-limited in process and capped by `FIBER_PAYMENT_MAX_CKB`. Live execution additionally requires a server opt-in and a matching bearer token. The target peer remains server-configured.

## Configure

Create `.env.local` from `.env.example`:

```dotenv
FIBER_RPC_URL=http://127.0.0.1:8227
FNN_CLI_PATH=D:\CKB\fiber-bin\fnn-cli.exe
FIBER_PAYMENT_TARGET_PUBKEY=<trusted-testnet-peer-pubkey>
FIBER_PAYMENT_MAX_CKB=0.05
FIBER_PAYMENT_COOLDOWN_MS=30000
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

For the bounded local execution proof:

```powershell
pnpm run prove:fiber-execution
```

This command moves 0.01 testnet CKB. It discovers the ready channel target, generates an in-memory operator token, enables execution only in its temporary server process, requires final `Success`, verifies local and remote channel balance changes, and then closes the execution process. Evidence is written to `artifacts/fiber-live-execution.json` and ignored by Git.

## Current boundary

The in-memory cooldown is suitable for a local or single-instance MVP. A public multi-instance deployment should replace it with shared rate limiting and authenticated, single-use payment capabilities.
