# July Week 2 Report - Flightcheck Submission and Live Proof

## Overview

This report covers **July 8 to July 15, 2026**. The second hackathon week turned Fiber Flightcheck from a live diagnostic MVP into a complete testnet submission with a bounded payment proof, redesigned product interface, security controls, documentation, hosted verification, and a silent demonstration video.

Repository history for this period shows the progression from payment execution work on July 8 through final repository cleanup on July 15.

---

## From Readiness Checks to Payment Proof

The major technical addition was a server-side **keysend payment proof**. Readiness alone showed that capacity appeared available, but the stronger question was whether FNN could prepare the requested payment route.

The proof path used an operator-configured peer and `fnn-cli send_payment` in dry-run mode. It was deliberately separated from the normal readiness amount:

```text
Readiness amount: checks whether the node has capacity for the user's request
Proof amount: tiny bounded amount used to prove payment preparation
```

The hosted proof amount was capped at **0.05 CKB**, with **0.01 CKB** used in the demonstration. This was an operator safety policy, not a Fiber protocol limit.

### Safeguards implemented

- server-configured proof target;
- no public target-peer selection;
- amount cap;
- request cooldown;
- redacted peer and payment hash output;
- private FNN RPC;
- dry-run mode by default;
- separate execution setting and operator token;
- testnet-only public demonstration.

This allowed the project to demonstrate real payment preparation without turning the public interface into an unrestricted payment endpoint.

---

## Product Redesign

The application was restructured into three distinct product areas:

| Page | Purpose |
|------|---------|
| Home | explain the problem, value, and security posture |
| Console | run live readiness checks, payment proof, funding, and channel analysis |
| Runbook | show operational controls, deterministic failures, and raw audit output |

The redesign addressed earlier layout and presentation problems:

- oversized and overlapping landing text;
- cards with insufficient separation;
- long identifiers dominating the page;
- one continuous page containing several different workflows;
- weak distinction between live and simulated data;
- generic button styling and inconsistent information hierarchy.

The final interface used a Fiber-aligned dark product theme, responsive card layout, deliberate spacing, collapsed technical identifiers, and a stronger visual distinction between readiness, proof, funding, channels, and findings.

---

## Readiness and Channel Clarity

The readiness panel was refined to explain why a node could be ready to send while showing zero receivable capacity. Send and receive balances were kept separate:

- **max sendable** is derived from local channel liquidity;
- **max receivable** is derived from remote channel liquidity;
- a payment request is evaluated in the requested direction;
- zero receivable capacity does not invalidate an outbound payment.

The channel view showed:

- normalized lifecycle state;
- asset;
- local and remote balances;
- public/private status;
- peer identifier;
- channel outpoint;
- technical details behind an expandable control.

This made the application useful for both non-specialists and experienced Fiber operators.

---

## Reports and Audit Artifacts

The export surface was expanded from Markdown and JSON to a PDF-ready report.

The report included:

- generated timestamp;
- request amount and asset;
- ready or blocked status;
- maximum sendable and receivable capacity;
- next action;
- node and network data;
- funding status;
- channel table;
- structured findings;
- server-redacted identifiers.

The PDF flow used a clean A4 print layout and the browser's Save as PDF destination. Dynamic values were HTML-escaped before rendering.

---

## Deterministic Failure Coverage

The Runbook's Scenario Lab provided repeatable failure cases without damaging the live node:

- RPC offline;
- no peers;
- no channels;
- insufficient outbound liquidity;
- unsupported asset.

The scenarios used the same diagnostics engine as the live path, but were clearly labelled as deterministic simulations. This made it possible to demonstrate both successful live infrastructure and useful failure handling in one judging session.

---

## Submission Documentation

The submission package was consolidated around judge-facing documentation:

- project overview and selected category;
- infrastructure gap;
- live and simulated functionality;
- technical architecture;
- trust boundary and security controls;
- setup and integration instructions;
- current limitations;
- future roadmap;
- screenshots and hosted demo;
- MIT license.

Duplicate planning notes, internal checklists, caption drafts, and unused components were removed from the public repository before submission. Local working copies were preserved separately.

---

## Silent Demonstration Video

A no-narration video was produced to present the project consistently under time pressure. It used on-screen captions and a scripted browser flow:

1. product problem and landing page;
2. live 10 CKB readiness request;
3. node, funding, channel, and liquidity evidence;
4. successful 0.01 CKB payment proof;
5. report export controls;
6. low-liquidity failure scenario;
7. closing project statement and repository link.

The final video was recorded at 1920x1080 and kept below three minutes. Sampled frames were checked to confirm that the successful proof and low-liquidity blocker were visible and that no credentials were exposed.

---

## Final Verification

The final submission was verified through:

```powershell
npm run lint
npm run build
npm run run:all
```

Hosted checks confirmed:

- application health returned `ok: true`;
- Fiber testnet chain hash was detected;
- node synchronization was true;
- peers were connected;
- one public channel was open;
- a 10 CKB readiness request passed;
- a 0.01 CKB dry-run proof succeeded;
- the private FNN RPC was not exposed publicly;
- public live execution remained disabled;
- GitHub and VPS commits were aligned.

---

## Concrete Commit Progression

| Date | Milestone |
|------|-----------|
| July 8 | user onboarding, liquidity clarification, gated payment proof, multi-page redesign |
| July 14 | responsive spacing and hierarchy fixes |
| July 15 | submission release, verification, separate proof amount, PDF reports, silent demo, repository cleanup |

---

## Outcomes

1. Added a real bounded payment-preparation proof to the readiness engine.
2. Converted the UI into a coherent multi-page product.
3. Implemented security controls around RPC, peer targets, hashes, amounts, cooldown, and execution.
4. Added Markdown, JSON, PDF-ready, and proof artifacts.
5. Produced complete technical documentation and a hosted judging flow.
6. Submitted a live Fiber testnet infrastructure MVP.

---

## References

- [Fiber Flightcheck repository](https://github.com/Jayrodri088/fiber-flightcheck)
- [Fiber documentation](https://www.fiber.world/docs)
- [Fiber basic transfer](https://docs.fiber.world/docs/quick-start/basic-transfer)

