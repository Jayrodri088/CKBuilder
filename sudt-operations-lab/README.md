# SUDT Operations Lab

An interactive reconstruction of the 2022 `ckb-cli` SUDT operations tutorial.
It models issuance, Anyone-Can-Pay cells, cheque claim, direct transfer, and the
six-epoch sender refund path without requiring a running CKB node.

The original commands are retained as historical reference. For new production
token applications, evaluate xUDT and current CKB tooling rather than assuming
the old pinned deployment flow is still appropriate.

## Run

```powershell
npm install
npm start
```

## Verify

```powershell
npm run run:all
```

The proof executes the complete tutorial and checks the final accounting:

- total issued: 2,300 SUDT
- Alice: 1,200 SUDT
- Bob: 1,100 SUDT
- pending cheques: 0 SUDT
- elapsed time: 6 epochs

## Source

- [CKB CLI SUDT Operations Tutorial](https://github.com/nervosnetwork/ckb-cli/wiki/UDT-%28sudt%29-Operations-Tutorial)
- [RFC 0025: Simple UDT](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md)
- [RFC 0026: Anyone Can Pay](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0026-anyone-can-pay/0026-anyone-can-pay.md)
- [RFC 0038: CKB Cheque Lock](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0038-ckb-cheque-lock/0038-ckb-cheque-lock.md)
