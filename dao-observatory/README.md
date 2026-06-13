# DAO Observatory

An interactive reconstruction of the Nervos DAO lifecycle, inspired by the
NervDAO wallet interface and grounded in the validation logic from the canonical
`dao.c` system script.

This is a deterministic educational simulator. It does not connect a wallet or
submit transactions.

## What it demonstrates

- deposit cells with eight zero data bytes
- compensation on capacity not occupied by cell storage
- phase-one redemption and the deposit block-number marker
- 180-epoch checkpoint rounding
- compensation freezing at the phase-one withdrawal header
- absolute epoch `since` validation
- final maximum-withdraw capacity calculation

## Run

```powershell
npm install
npm start
```

## Verify

```powershell
npm run run:all
```

## Sources

- [NervDAO](https://github.com/ckb-devrel/nervdao)
- [Nervos DAO system script](https://github.com/nervosnetwork/ckb-system-scripts/blob/master/c/dao.c)
- [RFC 0023: DAO Deposit and Withdraw](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md)
