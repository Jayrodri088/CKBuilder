# July Week 4 Report - Next-Track Preparation and Advanced CKB/Fiber Study

## Overview

This report covers **July 22 to July 31, 2026**. The final part of July focused on preparing a stronger project direction for the next Fiber build track and deepening the CKB concepts required to support it safely.

The central design outcome was a **consumer payment product with two rails**:

```text
Primary rail: Fiber preflight and off-chain settlement
Fallback rail: CKB L1 hash-lock funding and merchant claim
```

This work remained research and implementation planning during July. Its validity is supported by the August `fiber-pulse/` implementation, which follows the same create, share, preflight, settle, fallback, fund-check, and claim-handoff model.

---

## Next Hackathon / Product Track Preparation

The preparation goal was to avoid repeating the earlier infrastructure-only pattern. The next project needed to be:

- immediately understandable to a non-operator;
- visibly useful within a short demonstration;
- technically grounded in Fiber and CKB;
- honest about mock, testnet, and live behavior;
- modular enough to continue after the event;
- secure enough that private RPC and claim secrets remained outside public links.

The proposed product was provisionally framed as a payment request application rather than a node tool.

### Target user flow

1. Merchant creates a payment request.
2. Application creates a self-contained payer link and QR code.
3. Payer opens the request and sees amount, expiry, and rail status.
4. Preflight checks Fiber connectivity and outbound capacity.
5. Fiber settles when capacity allows.
6. If Fiber is blocked, the payer switches to a CKB L1 hash-lock address.
7. The application monitors funding.
8. Merchant opens a prefilled claim flow using the secret preimage.
9. Both paths produce explicit status and evidence.

This was designed as a product layer over the technical work already completed in Flightcheck and CKB Pay Link.

---

## Dual-Rail Architecture Research

The two rails solve different failure modes and cannot be treated as one transaction path.

### Fiber rail

The Fiber rail requires:

- a reachable and synchronized FNN node;
- a suitable open channel;
- correct payment asset;
- enough outbound capacity;
- invoice or keysend parameters;
- clear payment status and receipt handling.

It provides fast off-chain settlement but depends on channel state and liquidity direction.

### CKB L1 rail

The L1 fallback requires:

- a deployed hash-lock script;
- current cell-dep metadata;
- a lock address derived from the merchant's secret commitment;
- enough CKB to satisfy occupied-capacity requirements;
- a funding monitor;
- a claim transaction with the preimage in the witness;
- safe handling of the merchant secret.

It does not provide the same instant UX as Fiber, but it gives the request a deterministic fallback when channel conditions are unsuitable.

---

## Request Codec and State Model

A payment-link product needs a compact state model rather than UI-only variables. The planned request fields included:

| Field | Purpose |
|-------|---------|
| id | stable request identity |
| amount | requested payment value |
| asset | CKB or supported Fiber asset |
| recipient / merchant | payment destination context |
| mode | invoice or bounded stream/session |
| expiry | prevents stale requests from appearing payable |
| rail | Fiber or L1 fallback |
| status | created, ready, blocked, paid, expired, or handed off |
| metadata | user-facing label and description |

The payer-facing encoding must exclude the merchant preimage. The merchant may retain it locally or pass it only into a trusted claim flow.

---

## Advanced CKB Study: Occupied Capacity and Change

The L1 fallback research highlighted a constraint that is easy to miss in product design: a CKB cell must carry enough capacity for its serialized lock, type, and data.

The hash-lock path uses `ckb_js_vm`, so its loader arguments are larger than a standard lock. This means:

- a small nominal payment may not create a valid lock cell;
- a partial claim may also require enough remaining capacity for a change cell;
- UI validation must consider occupied capacity, not only requested amount;
- demonstration amounts must be selected from actual transaction constraints.

This investigation led to the later August rule of using approximately **110 CKB or more** for the current hash-lock deployment and funding extra capacity when a claim leaves change.

---

## Advanced CKB Study: Script and Witness Boundaries

The next-track design reinforced several script-course concepts:

### Lock script role

The lock script controls who can consume the payment cell. In the fallback design, ownership is expressed through knowledge of the preimage rather than a standard account signature.

### Witness role

The witness carries the preimage proof during claim. The preimage should not be encoded into the public payer link because that would allow anyone to unlock the cell.

### Cell-dep role

The transaction must reference the exact deployed script cell. Deployment resets or stale metadata can cause resolution failures before the VM evaluates the witness.

### Transaction construction order

The application must derive the lock, select cells, create valid outputs and change, attach cell deps, set the witness, complete fees, sign where required, and only then broadcast.

These were treated as product requirements because failures at any layer must produce useful UI feedback.

---

## Advanced Fiber Study: Honest Live and Mock Modes

The next project was designed to remain demonstrable even when FNN was unavailable, but without presenting simulation as live settlement.

The planned policy was:

- show a visible `MOCK` or `LIVE` badge;
- allow a live RPC connectivity probe;
- keep mock capacity deterministic for UI development;
- state when estimated settlement time is simulated;
- do not label a payment as live based only on RPC reachability;
- require actual invoice/payment API results before claiming live Fiber settlement;
- keep L1 proof separately verifiable against OffCKB or testnet.

This policy later shaped the mock-first Fiber Pulse MVP and its optional live FNN probe.

---

## Security and Abuse Analysis

The planned payment product introduced risks beyond Flightcheck's read-mostly workflow.

| Risk | Planned control |
|------|-----------------|
| leaked merchant preimage | exclude it from payer links and QR payloads |
| stale payment link | expiry and countdown |
| repeated browser spending | session spend cap |
| arbitrary RPC proxying | server-configured Fiber RPC |
| false live-settlement claim | explicit mock/live mode and receipt source |
| insufficient L1 capacity | preflight amount and occupied-capacity guidance |
| stale deployment metadata | synchronize cell deps from the deployed Pay Link project |
| unsafe automatic fallback | require visible user choice and clear handoff state |

This analysis defined the minimum security posture for implementation.

---

## Planned Verification Strategy

The July design required every major state transition to have a runnable proof:

```text
Request codec round-trip
Preflight ready / blocked scenarios
Session-cap enforcement
L1 handoff URL validation
Live CKB RPC and cell-dep check
Funding status lookup
Deposit -> funded -> claim lifecycle
Optional live Fiber RPC probe
TypeScript and production build
```

This became the basis of August's `prove-codec`, `prove-l1-handoff`, `prove-l1-live`, `prove-l1-fund-claim`, and `run:all` scripts.

---

## August Implementation Plan Produced

The final plan was divided into small delivery stages:

### Stage 1: consumer-shaped mock MVP

- create payment request;
- encode share link;
- QR and countdown;
- deterministic Fiber preflight;
- capacity strip;
- receipt and session cap.

### Stage 2: L1 fallback

- derive live hash-lock address;
- synchronize deployment files;
- show funding instructions;
- monitor funding status;
- deep-link into merchant claim;
- prove deposit-to-claim lifecycle.

### Stage 3: live Fiber execution

- start the local FNN node;
- wire invoice/payment APIs;
- replace simulated settlement only where channel state supports it;
- preserve actionable failure messages and L1 fallback.

This sequencing reduced the risk of blocking the entire product on live channel infrastructure.

---

## Outcomes

1. Defined a differentiated consumer payment direction for the next build track.
2. Designed a clear Fiber-first, CKB-L1-fallback architecture.
3. Specified payment request, expiry, status, and handoff data boundaries.
4. Converted occupied capacity, witnesses, and cell deps into product-level requirements.
5. Established honest mock/live presentation rules.
6. Produced a runnable verification plan that maps directly to August's implementation.

---

## Next Steps

- Build the consumer request and payer experience.
- Reuse Pay Link deployment metadata for the L1 fallback.
- Add live funding checks and claim handoff.
- Start FNN and replace simulated Fiber settlement only after real invoice/payment verification.

---

## References

- [Fiber documentation](https://www.fiber.world/docs)
- [Fiber basic transfer](https://docs.fiber.world/docs/quick-start/basic-transfer)
- [CKB Script Course](https://docs.nervos.org/docs/script/intro-to-script)
- [Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock)
- [CCC documentation](https://docs.ckbccc.com/)

