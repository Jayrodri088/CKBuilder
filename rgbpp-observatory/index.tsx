import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  activeCell,
  activeSeal,
  finalizeVerification,
  initialState,
  prepareTransfer,
  submitCkbTransaction,
  validateLatest,
  type Owner,
  type RgbppState,
} from "./lib/rgbpp-model";
import { deploymentFacts, flowSteps } from "./lib/protocol";
import "./styles.css";

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BindingPanel({ state }: { state: RgbppState }) {
  const seal = activeSeal(state);
  const cell = activeCell(state);
  return (
    <section className="binding-panel">
      <div className="panel-title">
        <span>Isomorphic binding</span>
        <h2>Bitcoin UTXO controls CKB state</h2>
      </div>
      <div className="binding-map">
        <article className="btc-node">
          <span>Bitcoin seal</span>
          <strong>{seal.id}</strong>
          <code>{seal.owner} / {seal.sats.toLocaleString()} sats / {seal.spent ? "spent" : "live"}</code>
        </article>
        <div className="bridge-line">
          <i />
          <span>1 : 1</span>
        </div>
        <article className="ckb-node">
          <span>CKB cell</span>
          <strong>{cell.id}</strong>
          <code>{cell.assetType} / {cell.amount.toLocaleString()} units / owner {cell.owner}</code>
        </article>
      </div>
    </section>
  );
}

function RailView({ state }: { state: RgbppState }) {
  const btcTx = state.btcTxs[state.btcTxs.length - 1];
  const ckbTx = state.ckbTxs[state.ckbTxs.length - 1];
  return (
    <section className="rail-view">
      <div className="rail btc">
        <div className="rail-head"><span>Bitcoin layer</span><strong>single-use seal</strong></div>
        {btcTx ? (
          <div className="tx-card">
            <span>{btcTx.id}</span>
            <p>Spend {btcTx.inputSeal}</p>
            <p>Create {btcTx.outputSeal}</p>
            <code>OP_RETURN {btcTx.opReturn.slice(0, 22)}...</code>
            <small>SPV proof {btcTx.merkleProof}</small>
          </div>
        ) : (
          <p className="empty">No Bitcoin commitment transaction yet.</p>
        )}
      </div>

      <div className="rail ckb">
        <div className="rail-head"><span>CKB layer</span><strong>programmable state</strong></div>
        {ckbTx ? (
          <div className="tx-card">
            <span>{ckbTx.id}</span>
            <p>Consume {ckbTx.inputCell}</p>
            <p>Create {ckbTx.outputCell}</p>
            <code>commitment {ckbTx.commitment.slice(0, 22)}...</code>
            <small>witness {ckbTx.witnessBtcTx}</small>
          </div>
        ) : (
          <p className="empty">No CKB state transaction yet.</p>
        )}
      </div>
    </section>
  );
}

function ValidationGates({ state }: { state: RgbppState }) {
  const gates = validateLatest(state);
  return (
    <section className="gates">
      <div className="panel-title">
        <span>On-chain verification</span>
        <h2>RGB++ script gates</h2>
      </div>
      {gates.map((gate) => (
        <div className={`gate ${gate.status}`} key={gate.title}>
          <i />
          <div>
            <strong>{gate.title}</strong>
            <p>{gate.detail}</p>
          </div>
          <span>{gate.status}</span>
        </div>
      ))}
    </section>
  );
}

function FlowSteps() {
  return (
    <section className="flow">
      {flowSteps.map((step, index) => (
        <article key={step.title}>
          <span>0{index + 1}</span>
          <strong>{step.title}</strong>
          <p>{step.detail}</p>
        </article>
      ))}
    </section>
  );
}

function DeploymentFacts() {
  return (
    <section className="deployments">
      <div className="panel-title">
        <span>Resources page</span>
        <h2>Known RGB++ deployments</h2>
      </div>
      {deploymentFacts.map((fact) => (
        <div className="deployment" key={fact.network}>
          <span>{fact.network}</span>
          <strong>{fact.script}</strong>
          <code>{fact.codeHash}</code>
        </div>
      ))}
    </section>
  );
}

function App() {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState("");
  const owner = activeCell(state).owner;
  const nextOwner: Owner = owner === "alice" ? "bob" : "alice";

  const phaseLabel = useMemo(() => {
    if (state.phase === "issued") return "Ready to rotate seal";
    if (state.phase === "btc_submitted") return "Bitcoin commitment submitted";
    if (state.phase === "ckb_submitted") return "CKB state submitted";
    return "Transfer verified";
  }, [state.phase]);

  const perform = (fn: () => RgbppState) => {
    try {
      setState(fn());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <main>
      <header>
        <a className="brand" href="#">
          <i />
          <span>RGB++ Observatory</span>
        </a>
        <nav>
          <a href="https://rgbpp.com/docs/introduction" target="_blank" rel="noreferrer">Docs</a>
          <a href="https://explorer.rgbpp.io/en" target="_blank" rel="noreferrer">Explorer</a>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Bitcoin security / CKB programmability</p>
        <h1>One Bitcoin seal, one CKB cell, one programmable asset state.</h1>
        <p>
          RGB++ binds Bitcoin UTXOs to CKB cells. Bitcoin provides the single-use
          ownership seal, while CKB scripts validate the asset state transition.
        </p>
      </section>

      <section className="metrics">
        <Metric label="Protocol phase" value={phaseLabel} accent />
        <Metric label="Active owner" value={owner} />
        <Metric label="RGB++ amount" value={`${activeCell(state).amount.toLocaleString()} xUDT`} />
        <Metric label="Paired txs" value={`${state.btcTxs.length} BTC / ${state.ckbTxs.length} CKB`} />
      </section>

      <FlowSteps />

      <section className="workspace">
        <div className="left">
          <BindingPanel state={state} />
          <RailView state={state} />
        </div>
        <aside className="right">
          <div className="controls">
            <div className="panel-title">
              <span>Lifecycle</span>
              <h2>Rotate the seal</h2>
            </div>
            <p>
              Transfer ownership by spending the current Bitcoin UTXO, committing
              to the CKB transition, then submitting and verifying the CKB state.
            </p>
            <button
              type="button"
              disabled={state.phase === "btc_submitted" || state.phase === "ckb_submitted"}
              onClick={() => perform(() => prepareTransfer(state, nextOwner))}
            >
              1. Submit Bitcoin OP_RETURN to {nextOwner}
            </button>
            <button
              type="button"
              disabled={state.phase !== "btc_submitted"}
              onClick={() => perform(() => submitCkbTransaction(state))}
            >
              2. Submit CKB state transaction
            </button>
            <button
              type="button"
              disabled={state.phase !== "ckb_submitted"}
              onClick={() => perform(() => finalizeVerification(state))}
            >
              3. Verify RGB++ gates
            </button>
            {error && <p className="error">{error}</p>}
          </div>
          <ValidationGates state={state} />
        </aside>
      </section>

      <section className="lower">
        <DeploymentFacts />
        <section className="history">
          <div className="panel-title">
            <span>Explorer-style trace</span>
            <h2>Recent events</h2>
          </div>
          <ol>
            {state.history.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        </section>
      </section>

      <footer>
        <span>Offline deterministic model. No Bitcoin or CKB transaction is broadcast.</span>
        <span>single-use seal + OP_RETURN + SPV + isomorphic binding</span>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
