# Write & Read On-chain Data

This is a simple dApp example to show how to write and read data on the CKB blockchain. Read the step-by-step [tutorial](https://docs.nervos.org/docs/dapp/store-data-on-cell) to understand how it works and how to run it.

This example is originally modified from [hello, CKB](https://github.com/cryptape/ckb-tutorial) by [@Flouse](https://github.com/Flouse).

## Run

- Install dependencies:
  - `npm install`
- Verify local OffCKB devnet RPC:
  - `npm run check:devnet`
- Run on local devnet (OffCKB):
  - `npm run start:devnet`
- Run on testnet:
  - `npm run start:testnet`
- Run on mainnet:
  - `npm run start:mainnet`

## Next Step

Now that your dApp works great on local blockchain, you can switch environments to testnet or mainnet.

Set network to testnet and restart:

`export NETWORK=testnet`

On Windows PowerShell, use:

`$env:NETWORK='testnet'`

Or simply run:

`npm run start:testnet`
