# CKB Pay Link — weekend plan

## Goal

Devnet app: **create a hash-lock payment request → payer funds address → merchant claims** with CCC. Reuses `simple-lock` contract/deployment; adds payment-request UX and preflight scripts.

## MVP (this weekend)

| Step | Deliverable |
|------|-------------|
| 1 | Preflight: RPC + cell-dep live (`pnpm run preflight`) |
| 2 | **Create** — label, amount, preimage (generate), show pay address + merchant link |
| 3 | **Pay** — payer view via `?view=payer&address=…&amount=…` (copy address, poll balance) |
| 4 | **Claim** — preimage + receiver + amount → `unlock` tx |
| 5 | `pnpm run demo` — scripted checks + manual UI steps |

## Phase A (Fiber read-only) — done

- Tab **4. Fiber**: probe `node_info` + `list_channels` via `/api/fiber` proxy
- `pnpm run check:fiber` / `pnpm run fiber:status`
- `pnpm run preflight:all` = CKB + Fiber

## Out of scope (still)

Mainnet, Fiber send_payment (Phase B), refunds/CLTV, wallet connector UI, new contract code.

## Prereqs

1. OffCKB devnet on `http://127.0.0.1:28114`
2. `simple-lock` deployed OR `pnpm run sync:deployment` from current `simple-lock/frontend/deployment`

## Commands

```powershell
cd d:\CKB\Test\ckb-pay-link
pnpm install
pnpm run sync:deployment
pnpm run preflight
pnpm run dev
pnpm run demo
```

## Demo script (5 min for Neon)

1. `preflight` → PASS  
2. Open app → **Create** → Generate secret → copy **payer link**  
3. Fund lock address (faucet / second wallet) ≥ amount  
4. **Claim** → same preimage → receiver address → Claim → tx hash  

## File map

- `frontend/app/pay-link.ts` — lock math + unlock (from simple-lock)
- `frontend/app/page.tsx` — Create / Pay / Claim UI
- `scripts/sync-deployment.mjs` — copy deployment JSON from `../simple-lock`
- `scripts/check-cell-dep.mjs` — live cell dep check
