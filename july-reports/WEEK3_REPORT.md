# July Week 3 Report - Post-Hackathon Evaluation and Product Direction

## Overview

This report covers **July 16 to July 21, 2026**. After the intensive Flightcheck submission period, the focus shifted from feature delivery to evaluating the project as infrastructure, studying how it could be presented more clearly, and identifying a stronger follow-on direction for the next build track.

No new production release is claimed for this period. The concrete output was a post-hackathon assessment and an implementation backlog that connects directly to the consumer payment work started in August.

---

## Submission Retrospective

Flightcheck proved that a hosted service could convert private FNN state into a reusable payment-readiness decision. The retrospective separated what was technically strong from what could limit the project's impact in a competitive judging environment.

### Strong areas retained

- real FNN and Fiber testnet integration;
- hosted end-to-end workflow;
- clear private RPC trust boundary;
- amount-specific readiness;
- directional liquidity analysis;
- on-chain funding checks;
- bounded payment proof;
- structured CLI and API output;
- deterministic failure diagnostics;
- honest live-versus-simulated disclosure.

### Presentation and product weaknesses identified

1. **Crowded diagnostics category:** node preflight and checkup tools were a common hackathon direction.
2. **Indirect user value:** Flightcheck mostly helped operators and developers rather than completing a consumer task.
3. **Proof stopped before settlement:** dry-run evidence was safer, but less visually compelling than a completed payment flow.
4. **Long technical pages:** the console carried significant detail that was valuable for operators but difficult to summarize quickly.
5. **Single-node framing:** fleet monitoring, alerts, historical reliability, and route confidence were not implemented.
6. **Testnet/mainnet boundary:** the security model was suitable for a controlled testnet demo but required stronger authentication and operational controls for mainnet.

This assessment suggested that the next project should reuse Flightcheck's preflight intelligence inside a product where the user is trying to pay, not make diagnostics the entire product.

---

## Research: Presenting Infrastructure as a User Journey

The presentation research focused on replacing a feature tour with an outcome-based flow.

The proposed demonstration structure became:

```text
Create a payment request
  -> share it with a payer
  -> run preflight automatically
  -> settle on Fiber when possible
  -> provide a clear fallback when it is not
  -> produce a receipt or claim handoff
```

This structure carries the same readiness logic but places it behind a recognizable user goal.

### Presentation principles recorded

- show the problem before architecture;
- separate live functionality from simulation in the UI, not only in documentation;
- display one primary action per step;
- hide raw identifiers until technical details are requested;
- show a successful path and one meaningful failure path;
- provide a receipt or proof artifact at the end;
- keep infrastructure details available for judges without forcing every user to read them;
- state production limitations directly.

These principles later appear in August's payment request, payer view, preflight, fallback, and proof flows.

---

## Research: From Diagnostic Tool to Payment Product

Several follow-on options were compared:

| Direction | Value | Main risk |
|-----------|-------|-----------|
| Flightcheck SDK | easy integration for developers | less visible as a standalone demo |
| Fleet monitor | stronger operator value | needs history, persistence, and multiple nodes |
| Merchant gateway | clear business use case | payment and wallet security scope grows quickly |
| Consumer pay link | simple user story and shareable demo | requires safe payment state and fallback design |
| Cross-chain payment router | ambitious differentiation | too much protocol and custody scope for one short build |

The consumer pay-link direction was selected for deeper preparation because it could reuse:

- Flightcheck's readiness engine;
- existing CKB Pay Link hash-lock work;
- CCC transaction knowledge;
- Fiber channel and liquidity understanding;
- report/proof patterns;
- the established server-side RPC boundary.

---

## Fiber Payment Flow Study

The technical study moved beyond node health into the lifecycle required by a consumer-shaped payment:

1. create a request with amount, asset, recipient, and expiry;
2. encode the request into a shareable link or QR payload;
3. validate expiry and request integrity;
4. check live Fiber node and channel state;
5. compare requested amount with outbound capacity;
6. request or construct an invoice where appropriate;
7. attempt settlement only after preflight;
8. update the receipt and remaining capacity;
9. preserve a fallback path if Fiber cannot complete.

This highlighted that payment readiness and payment execution are separate concerns. Flightcheck covered the former; the next track needed a product-state model around both.

---

## Security Requirements for the Follow-On Project

The post-hackathon security review produced concrete requirements:

- never include merchant claim secrets in payer-facing links;
- keep live Fiber RPC server-side;
- separate connectivity probes from payment execution;
- apply amount limits and session spend caps;
- expire payment requests;
- make mock and live state visually distinct;
- avoid claiming successful settlement when only RPC reachability was tested;
- retain an operator-controlled execution boundary;
- use testnet or local devnet for early payment proofs;
- provide a deterministic fallback without exposing private keys in the browser.

The session-cap, expiry, mock/live badge, and secret-handling requirements became visible features in the August Fiber Pulse implementation.

---

## Advanced Learning Topics

The week also connected the hackathon lessons to advanced CKB topics already present in the learning guidelines.

### Witnesses and script authorization

The earlier hash-lock work was revisited as a payment primitive:

- the lock args commit to a secret hash;
- the witness provides the preimage during claim;
- the payer can fund the lock without learning the secret;
- the merchant can claim by satisfying the script.

### Occupied capacity

Payment fallback design must account for CKB cell occupancy, not only transfer amount. Large lock args and script wrappers increase minimum cell capacity and affect whether a transaction can create a valid change cell.

### Cell dependencies and deployment state

A reusable L1 fallback must keep deployment metadata synchronized across applications. Stale cell deps can make an otherwise correct transaction fail before script execution.

### Payment channels

Fiber shifts repeated payment state off-chain, but L1 still funds and settles the channel. Product design must explain this boundary rather than presenting Fiber and CKB L1 as interchangeable transaction types.

---

## Concrete Output: Follow-On Requirements

The end-of-week requirements for the next implementation were:

- consumer create and payer views;
- self-contained share links;
- QR support;
- invoice and stream-like request modes;
- countdown and expiry handling;
- preflight with actionable blockers;
- mock-first mode with optional live Fiber RPC probe;
- session spend cap;
- Fiber capacity display;
- L1 hash-lock fallback;
- merchant-only secret handling;
- result receipt and test scripts.

These requirements provide a direct bridge from July's evaluation to the `fiber-pulse/` project committed in August.

---

## Outcomes

1. Completed a structured retrospective of Flightcheck's technical and judging strengths.
2. Identified the competitive limitation of another diagnostics-only project.
3. Reframed preflight as infrastructure inside a consumer payment journey.
4. Defined presentation rules for live, simulated, successful, and blocked states.
5. Produced the security and functional requirements for the next Fiber product track.
6. Connected the next project to existing CKB hash-lock, CCC, and script-course work.

---

## Next Week

- Design a dual-rail Fiber/L1 payment architecture.
- Define the request codec and handoff boundaries.
- Study occupied-capacity requirements for the hash-lock fallback.
- Convert the research requirements into an August implementation plan.

---

## References

- [Fiber documentation](https://www.fiber.world/docs)
- [Fiber basic transfer](https://docs.fiber.world/docs/quick-start/basic-transfer)
- [CKB Script Course](https://docs.nervos.org/docs/script/intro-to-script)
- [CCC documentation](https://docs.ckbccc.com/)

