# July Week 1 Report - Fiber Hackathon Build

## Overview

This report covers **July 1 to July 7, 2026**. The week focused on converting prior CKB and Fiber learning into a focused hackathon project with a defensible infrastructure use case.

The result was the first working release of **Fiber Flightcheck**, a payment-readiness and diagnostics gateway that answers a practical question before a Fiber payment is attempted:

> Can this node satisfy this payment request now, and if not, what must be fixed?

The week moved through project selection, competitive-scope analysis, architecture, live Fiber node setup, diagnostics implementation, hosted deployment, and an initial submission-ready UI.

---

## Hackathon Scope and Project Selection

The first task was reviewing the Fiber hackathon requirements and comparing possible project directions against the judging criteria. A major concern was avoiding a generic dashboard that only repeated data already available from FNN RPC or existing explorers.

The selected category was:

**Node, Routing, Cross-Chain, and Diagnostics Infrastructure**

The project was narrowed to pre-payment readiness because an online Fiber node can still be unable to complete a payment. The failure may be caused by:

- an unreachable RPC endpoint;
- an unsynchronized node;
- no connected peers;
- a pending, disabled, closing, or closed channel;
- unsupported payment assets;
- insufficient outbound liquidity;
- liquidity available only in the receiving direction;
- inadequate on-chain CKB funding for channel operations.

The core product decision was to turn those separate conditions into one reusable decision with structured blockers and a recommended next action.

---

## Initial Fiber Flightcheck Architecture

The first architecture established a strict boundary between the public application and the Fiber node:

```text
Browser / CLI
  -> Flightcheck application server
     -> private FNN JSON-RPC
  -> normalized Fiber snapshot
  -> diagnostics and readiness engine
  -> UI, CLI, JSON, and reports
```

The browser was not intended to communicate directly with FNN. This reduced the risk of exposing the operator's private RPC and made it possible to enforce one trusted node configuration on the server.

### Core modules delivered

| Module | Responsibility |
|--------|----------------|
| Fiber RPC adapter | query and normalize FNN node, peer, and channel data |
| Diagnostics engine | convert low-level state into blocking issues and warnings |
| Readiness engine | evaluate a requested amount and asset |
| Doctor CLI | provide human-readable operational diagnostics |
| Can-pay CLI | provide machine-readable payment readiness |
| Report generator | export the same result for audit and review |
| React interface | expose readiness without requiring raw RPC knowledge |

This preserved one decision model across developer and user-facing surfaces instead of duplicating logic in the UI.

---

## Live Fiber Node and Channel Work

A real FNN environment was required because mock-only output would not satisfy an infrastructure hackathon. The local and hosted setup work included:

- installing and testing FNN tooling;
- confirming the local JSON-RPC endpoint on port `8227`;
- checking `node_info`, `list_peers`, and `list_channels`;
- identifying the node funding lock from FNN data;
- confirming the Fiber testnet chain hash;
- funding the node sufficiently for channel operations;
- opening and monitoring a public CKB channel;
- distinguishing `ChannelReady` from pending lifecycle states;
- verifying local and remote channel balances.

The project also added a CKB testnet capacity lookup using the node's funding lock script. This separated two frequently confused states:

```text
On-chain CKB balance = ability to fund or open channels
Off-chain local balance = ability to send through an existing channel
Off-chain remote balance = ability to receive through an existing channel
```

That distinction became one of Flightcheck's most important diagnostic features.

---

## Hosted Deployment

The application and Fiber node were moved into a hosted test environment so judges would not need to run FNN locally.

Deployment work included:

- provisioning an Ubuntu VPS;
- securing SSH access with a key pair;
- cloning the project from GitHub for repeatable updates;
- running Flightcheck as a managed service;
- keeping FNN RPC private on the server;
- exposing the application through a reverse proxy;
- opening only the required ingress ports;
- adding an application health endpoint;
- validating the hosted node from an external machine.

The hosted model established that a judge could open one public URL while the application server privately inspected the live Fiber node.

---

## Security and Data-Exposure Decisions

The first release introduced several safeguards before adding more powerful payment behavior:

1. Public clients could not select arbitrary RPC targets in hosted mode.
2. The private FNN address was hidden behind a server-mediated connection label.
3. Node, channel, funding, and peer identifiers were prepared for redaction.
4. The hosted environment used Fiber testnet rather than mainnet funds.
5. Health checks exposed operational state without exposing credentials.

These decisions treated the tool as deployable infrastructure rather than a local development page.

---

## User Experience Refinement

The initial interface evolved from a mock-oriented dashboard into a live operational application. Work completed during the week included:

- a live endpoint mode;
- amount and asset input;
- a clear ready or blocked decision;
- node network, version, synchronization, peer, and channel displays;
- funding readiness;
- directional send and receive capacity;
- channel lifecycle information;
- actionable findings rather than raw RPC errors;
- report export controls.

The product language was also changed to describe the user's problem rather than the hackathon itself. This made the application usable beyond the competition context.

---

## Verification

The first release was checked through both mock and live paths:

```powershell
npm run doctor:mock
npm run can-pay:mock -- --amount 10 --asset CKB
npm run report:mock
npm run doctor -- --rpc http://127.0.0.1:8227 --amount 10 --asset CKB
npm run can-pay -- --rpc http://127.0.0.1:8227 --amount 10 --asset CKB
npm run lint
npm run build
```

The repository history records the initial submission build on **July 7**.

---

## Outcomes

1. Selected a specific infrastructure problem rather than a broad Fiber dashboard.
2. Built a shared diagnostics and amount-specific readiness engine.
3. Connected the project to a real FNN node and public testnet channel.
4. Added on-chain funding and directional off-chain liquidity checks.
5. Deployed a hosted application with a private RPC trust boundary.
6. Produced the first complete Fiber Flightcheck release.

---

## Next Week

- Add stronger proof that the node can prepare a real payment.
- Refine the application into a professional multi-page product.
- Add explicit proof caps, cooldowns, and execution controls.
- Prepare technical documentation, screenshots, and a concise judging flow.

---

## References

- [Fiber documentation](https://www.fiber.world/docs)
- [Run a Fiber Node](https://www.fiber.world/docs/quick-start/run-a-node)
- [Fiber basic transfer](https://docs.fiber.world/docs/quick-start/basic-transfer)
- [Fiber Flightcheck repository](https://github.com/Jayrodri088/fiber-flightcheck)

