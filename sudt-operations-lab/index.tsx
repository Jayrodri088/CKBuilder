import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  applyOperation,
  balanceOf,
  initialState,
  pendingFor,
  totalInCells,
  type LabState,
  type TokenCell,
} from "./lib/model";
import { accountName, stateSummary, tutorialSteps } from "./lib/tutorial";
import "./styles.css";

type HistoryItem = {
  title: string;
  detail: string;
};

const compact = (value: string) =>
  value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-5)}` : value;

function CellCard({ cell, epoch }: { cell: TokenCell; epoch: number }) {
  const isCheque = cell.kind === "cheque";
  const age = epoch - cell.createdEpoch;

  return (
    <article className={`cell-card ${cell.kind}`}>
      <div className="cell-topline">
        <span className="cell-kind">{isCheque ? "Cheque lock" : "ACP lock"}</span>
        <span className="live-dot">Live cell</span>
      </div>
      <strong className="cell-amount">{cell.amount.toLocaleString()} SUDT</strong>
      {isCheque ? (
        <div className="cell-route">
          <span>{accountName(cell.sender!)}</span>
          <span className="route-line">to</span>
          <span>{accountName(cell.receiver!)}</span>
        </div>
      ) : (
        <p className="cell-owner">{accountName(cell.holder!)}'s token account</p>
      )}
      <div className="cell-meta">
        <code>{compact(cell.id)}</code>
        <span>{isCheque ? `age ${age}/6 epochs` : "receives without signature"}</span>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "mint" | "alice" | "bob" | "pending";
}) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function App() {
  const [state, setState] = useState<LabState>(initialState);
  const [stepIndex, setStepIndex] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);

  const complete = stepIndex >= tutorialSteps.length;
  const step = tutorialSteps[Math.min(stepIndex, tutorialSteps.length - 1)];
  const progress = (stepIndex / tutorialSteps.length) * 100;
  const chequeTotal = state.cells
    .filter((cell) => cell.kind === "cheque")
    .reduce((total, cell) => total + cell.amount, 0);

  const status = useMemo(() => stateSummary(state), [state]);

  const executeStep = () => {
    if (complete) return;
    try {
      const next = applyOperation(state, step.operation);
      setState(next);
      setHistory((items) => [
        { title: step.title, detail: stateSummary(next) },
        ...items,
      ]);
      setStepIndex((index) => index + 1);
      setError("");
      setCopied(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const reset = () => {
    setState(initialState());
    setStepIndex(0);
    setHistory([]);
    setError("");
    setCopied(false);
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(step.command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main>
      <header className="hero">
        <nav>
          <a className="brand" href="#" aria-label="SUDT Operations Lab home">
            <span className="brand-mark">S</span>
            <span>SUDT Operations Lab</span>
          </a>
          <div className="nav-actions">
            <span className="network"><i /> Local simulation</span>
            <a
              className="source-link"
              href="https://github.com/nervosnetwork/ckb-cli/wiki/UDT-%28sudt%29-Operations-Tutorial"
              target="_blank"
              rel="noreferrer"
            >
              Original tutorial
            </a>
          </div>
        </nav>

        <div className="hero-copy">
          <p className="kicker">CKB CELL MODEL / GUIDED LAB</p>
          <h1>See a token move.<br /><em>Understand every cell.</em></h1>
          <p className="intro">
            Rebuilt from the classic ckb-cli walkthrough. Issue SUDT, receive through
            Anyone-Can-Pay, claim cheques, and recover an expired payment.
          </p>
          <div className="hero-notice">
            <span>Historical workflow</span>
            <p>
              This models the tutorial's 2022 SUDT commands. It is a learning environment,
              not a live wallet or current deployment recipe.
            </p>
          </div>
        </div>
      </header>

      <section className="dashboard">
        <div className="progress-heading">
          <div>
            <span className="section-label">Lifecycle progress</span>
            <strong>{complete ? "Lab complete" : `Step ${stepIndex + 1} of ${tutorialSteps.length}`}</strong>
          </div>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>

        <div className="metrics">
          <Metric label="Total issued" value={`${state.issued.toLocaleString()} SUDT`} tone="mint" />
          <Metric label="Alice / ACP" value={`${balanceOf(state, "alice").toLocaleString()} SUDT`} tone="alice" />
          <Metric label="Bob / ACP" value={`${balanceOf(state, "bob").toLocaleString()} SUDT`} tone="bob" />
          <Metric label="Pending cheques" value={`${chequeTotal.toLocaleString()} SUDT`} tone="pending" />
          <Metric label="Current epoch" value={state.epoch.toString()} />
        </div>

        <div className="workspace">
          <section className="stage-panel">
            <div className="panel-heading">
              <div>
                <span className="section-label">On-chain state</span>
                <h2>Live token cells</h2>
              </div>
              <span className="state-count">{status}</span>
            </div>

            <div className="cell-grid">
              {state.cells.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-cell" />
                  <h3>No token cells yet</h3>
                  <p>Run the first operation to create Alice's empty ACP cell.</p>
                </div>
              ) : (
                state.cells.map((cell) => (
                  <CellCard key={cell.id} cell={cell} epoch={state.epoch} />
                ))
              )}
            </div>

            <div className="supply-check">
              <span>Supply invariant</span>
              <code>issued ({state.issued}) = sum(cell data) ({totalInCells(state)})</code>
              <strong>PASS</strong>
            </div>
          </section>

          <aside className="operation-panel">
            {!complete ? (
              <>
                <span className="step-eyebrow">{step.eyebrow}</span>
                <h2>{step.title}</h2>
                <p className="step-description">{step.description}</p>

                <div className="lesson">
                  <span>What this proves</span>
                  <p>{step.lesson}</p>
                </div>

                <div className="command-heading">
                  <span>Equivalent ckb-cli command</span>
                  <button type="button" className="copy" onClick={() => void copyCommand()}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="command"><code>{step.command}</code></pre>
                {error && <p className="error">{error}</p>}
                <button type="button" className="execute" onClick={executeStep}>
                  Execute operation <span>→</span>
                </button>
              </>
            ) : (
              <div className="completion">
                <span className="completion-mark">✓</span>
                <span className="step-eyebrow">Lifecycle complete</span>
                <h2>Every token accounted for.</h2>
                <p>
                  The owner issued 2,300 SUDT. Alice holds 1,200, Bob holds 1,100,
                  and no cheque remains pending.
                </p>
                <div className="final-equation">1,200 + 1,100 = 2,300</div>
                <button type="button" className="execute" onClick={reset}>
                  Run the lab again <span>↻</span>
                </button>
              </div>
            )}
          </aside>
        </div>

        <section className="lower-grid">
          <article className="history-panel">
            <div className="panel-heading">
              <div>
                <span className="section-label">Transaction journal</span>
                <h2>Operations executed</h2>
              </div>
              {history.length > 0 && (
                <button type="button" className="reset-link" onClick={reset}>Reset lab</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="history-empty">Your completed operations will appear here.</p>
            ) : (
              <ol className="history-list">
                {history.map((item, index) => (
                  <li key={`${item.title}-${history.length - index}`}>
                    <span>{history.length - index}</span>
                    <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <article className="concept-panel">
            <span className="section-label">The mental model</span>
            <h2>One type script, two lock strategies</h2>
            <div className="concept-row">
              <span className="concept-icon acp-icon">A</span>
              <div><strong>Anyone-Can-Pay</strong><p>Lets anyone add value; only the owner can reduce it.</p></div>
            </div>
            <div className="concept-row">
              <span className="concept-icon cheque-icon">C</span>
              <div><strong>Cheque lock</strong><p>Receiver claims now; sender refunds after the timelock.</p></div>
            </div>
            <button type="button" className="text-button" onClick={() => setShowConcepts(!showConcepts)}>
              {showConcepts ? "Hide" : "Show"} script composition
            </button>
            {showConcepts && (
              <div className="script-stack">
                <div><span>TYPE</span><strong>simple_udt</strong><small>validates amount conservation and issuance</small></div>
                <b>+</b>
                <div><span>LOCK</span><strong>ACP or cheque</strong><small>decides who can consume each cell</small></div>
              </div>
            )}
          </article>
        </section>
      </section>

      <footer>
        <span>Reconstructed as an educational simulation</span>
        <div>
          <a href="https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md" target="_blank" rel="noreferrer">RFC 0025</a>
          <a href="https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0026-anyone-can-pay/0026-anyone-can-pay.md" target="_blank" rel="noreferrer">RFC 0026</a>
          <a href="https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0038-ckb-cheque-lock/0038-ckb-cheque-lock.md" target="_blank" rel="noreferrer">RFC 0038</a>
        </div>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
