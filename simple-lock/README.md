# simple-lock

A JavaScript/TypeScript dApp demonstrating the `hash-lock` smart contract on CKB.

## Overview

This project demonstrates a full-stack dApp using the CKB JavaScript VM (ckb-js-vm).
It includes a `hash-lock` contract and a web frontend for interacting with it.

## Project Structure

```
simple-lock/
├── contracts/           # Smart contract source code
│   └── hash-lock/       # Hash-lock contract
│       └── src/
│           └── index.ts # Contract implementation
├── frontend/            # Next.js web frontend
│   └── app/
│       └── hash-lock.ts # Frontend integration
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- pnpm package manager
- **`ckb-debugger`** on your PATH — required to compile `.js` contracts to `.bc` bytecode (see [CKB debugger](https://github.com/nervosnetwork/ckb-standalone-debugger)). The frontend can still run using the checked-in `deployment/` metadata; you only need this when rebuilding or redeploying contracts.

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

### Building Contracts

Build all contracts (after `ckb-debugger` is installed and on PATH):

```bash
pnpm run build
```

If `ckb-debugger` is missing, the bundler step may still produce `dist/*.js`, but bytecode (`.bc`) generation will fail. Use the tutorial’s toolchain or install the debugger from the CKB releases for your OS.

Build a specific contract:

```bash
pnpm run build:contract hello-world
```

### Running Tests

Run all tests:

```bash
pnpm test
```

Run tests for a specific contract:

```bash
pnpm test -- hello-world
```

### Adding New Contracts

Create a new contract:

```bash
pnpm run add-contract my-new-contract
```

This will:

- Create a new contract directory under `contracts/`
- Generate a basic contract template
- Create a corresponding test file

## Development

### Contract Development

1. Edit your contract in `contracts/<contract-name>/src/index.typescript`
2. Build the contract: `pnpm run build:contract <contract-name>`
3. Run tests: `pnpm test -- <contract-name>`

### Build Output

All contracts are built to the global `dist/` directory:

- `dist/{contract-name}.js` - Bundled JavaScript code
- `dist/{contract-name}.bc` - Compiled bytecode for CKB execution

### Testing

Tests use the `ckb-testtool` framework to simulate CKB blockchain execution. Each test:

1. Sets up a mock CKB environment
2. Deploys the contract bytecode
3. Executes transactions
4. Verifies results

## Available Scripts

- `build` - Build all contracts
- `build:contract <name>` - Build a specific contract
- `test` - Run all tests
- `add-contract <name>` - Add a new contract
- `deploy` - Deploy contracts to CKB network
- `clean` - Remove all build outputs
- `format` - Format code with Prettier

## Deployment

Deploy your contracts to CKB networks using the built-in deploy script:

### Basic Usage

```bash
# Deploy to devnet (default)
pnpm run deploy

# Deploy to testnet
pnpm run deploy -- --network testnet

# Deploy to mainnet
pnpm run deploy -- --network mainnet
```

### Advanced Options

```bash
# Deploy with upgradable type ID
pnpm run deploy -- --network testnet --type-id

# Deploy with custom private key
pnpm run deploy -- --network testnet --privkey 0x...

# Combine multiple options
pnpm run deploy -- --network testnet --type-id --privkey 0x...
```

### Available Options

- `--network <network>` - Target network: `devnet`, `testnet`, or `mainnet` (default: `devnet`)
- `--privkey <privkey>` - Private key for deployment (default: uses offckb's deployer account)
- `--type-id` - Enable upgradable type ID for contract updates

### Deployment Artifacts

After successful deployment, artifacts are saved to the `deployment/` directory:

- `deployment/scripts.json` - Contract script information
- `deployment/<network>/<contract>/deployment.toml` - Deployment configuration
- `deployment/<network>/<contract>/migrations/` - Migration history

## Dependencies

### Core Dependencies

- `@ckb-js-std/bindings` - CKB JavaScript VM bindings
- `@ckb-js-std/core` - Core CKB JavaScript utilities

### Development Dependencies

- `ckb-testtool` - Testing framework for CKB contracts
- `esbuild` - Fast JavaScript bundler
- `jest` - JavaScript testing framework
- `typescript` - TypeScript compiler
- `ts-jest` - TypeScript support for Jest
- `prettier` - Code formatter

## Resources

- [CKB JavaScript VM Documentation](https://github.com/nervosnetwork/ckb-js-vm)
- [CKB Developer Documentation](https://docs.nervos.org/docs/script/js/js-quick-start)
- [The Little Book of ckb-js-vm ](https://nervosnetwork.github.io/ckb-js-vm/)

## License

MIT

---

## CKBuilders quick start (this repo copy)

Official tutorial: [Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock).

1. Start OffCKB devnet: `offckb node`
2. From repo root, verify RPC: `pnpm run check:devnet`
3. Install dependencies: `pnpm install`. Rebuild contracts with `pnpm run build` only if you have **`ckb-debugger`** on PATH; otherwise rely on existing `frontend/deployment/scripts.json` for devnet.
4. If you deploy a new bytecode, copy `deployment/scripts.json` to `frontend/deployment/scripts.json` (and sync `system-scripts.json` if needed), then restart the app.
5. Frontend (from `frontend/`):

   - `pnpm install`
   - `pnpm run dev:devnet` (Windows-friendly; sets `NEXT_PUBLIC_NETWORK=devnet`)

Open [http://localhost:3000](http://localhost:3000).
