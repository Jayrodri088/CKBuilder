# RGB++ Observatory

An offline-first RGB++ learning lab that models Bitcoin single-use seals,
isomorphic binding to CKB cells, OP_RETURN commitments, SPV validation, and CKB
state transitions.

It is not a wallet and does not broadcast Bitcoin or CKB transactions. It is a
deterministic protocol observatory built from the RGB++ documentation.

## What It Demonstrates

- Bitcoin UTXOs as single-use seals
- one-to-one binding between Bitcoin UTXOs and CKB cells
- paired Bitcoin and CKB transaction flow
- OP_RETURN commitment to the CKB state transition
- SPV/light-client style validation gates
- RGB++ xUDT amount conservation across transfers
- explorer-style transaction and binding views

## Run

```powershell
npm install
npm start
```

## Verify

```powershell
npm run run:all
```

The proof executes Alice -> Bob -> Alice transfers and checks seal rotation,
commitment matching, SPV gate status, binding ownership, and xUDT amount
conservation.

## Sources

- [RGB++ Introduction](https://rgbpp.com/docs/introduction)
- [Single-Use Seal](https://rgbpp.com/docs/single-use-seal)
- [State Validation](https://rgbpp.com/docs/state-validation)
- [Isomorphic Binding](https://rgbpp.com/docs/isomorphic-binding)
- [RGB++ Resources](https://rgbpp.com/docs/resources)
- [RGB++ Light Paper](https://talk.nervos.org/t/rgb-protocol-light-paper-translation/7790)
- [RGB++ Explorer](https://explorer.rgbpp.io/en)
