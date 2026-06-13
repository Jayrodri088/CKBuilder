import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  advanceEpochs,
  arAtEpoch,
  ckb,
  compensation,
  deposit,
  finalizeWithdrawal,
  formatCkb,
  initialState,
  LOCK_PERIOD_EPOCHS,
  nextClaimEpoch,
  requestWithdrawal,
  type DaoState,
} from "./lib/dao-model";
import { phaseCopy, protocolGates } from "./lib/protocol";
import "./styles.css";

type Event = {
  epoch: number;
  title: string;
  detail: string;
};

const shortAr = (value: bigint) => (Number(value) / 1e16).toFixed(7);

function CellDiagram({ state }: { state: DaoState }) {
  const copy = phaseCopy[state.phase];
  const hasCell = state.phase === "deposited" || state.phase === "withdrawing";

  return (
    <section className={`cell-vessel ${state.phase}`}>
      <div className="vessel-grid" />
      <div className="cell-caption">
        <span>LIVE CELL / {state.phase.toUpperCase()}</span>
        <span className="status-lamp"><i /> {copy.label}</span>
      </div>
      {hasCell ? (
        <>
          <div className="capacity-orbit">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="capacity-core">
              <small>CAPACITY</small>
              <strong>{formatCkb(state.depositCapacity, 0)}</strong>
              <span>CKB</span>
            </div>
          </div>
          <div className="cell-anatomy">
            <div><span>LOCK</span><code>secp256k1_blake160</code></div>
            <div><span>TYPE</span><code>nervos_dao / args: 0x</code></div>
            <div><span>DATA</span><code>{copy.data}</code></div>
          </div>
        </>
      ) : (
        <div className="no-cell">
          <div className="wallet-glyph"><span /><span /><span /></div>
          <strong>{copy.title}</strong>
          <p>{copy.description}</p>
        </div>
      )}
    </section>
  );
}

function Timeline({ state }: { state: DaoState }) {
  const depositEpoch = state.depositEpoch;
  const current = state.currentEpoch;
  const projectedClaim =
    state.phase === "wallet"
      ? depositEpoch + LOCK_PERIOD_EPOCHS
      : state.claimEpoch ?? (current > depositEpoch ? nextClaimEpoch(depositEpoch, current) : depositEpoch + LOCK_PERIOD_EPOCHS);
  const span = Math.max(LOCK_PERIOD_EPOCHS, projectedClaim - depositEpoch);
  const currentPosition = Math.min(100, Math.max(0, ((current - depositEpoch) / span) * 100));
  const withdrawPosition = state.withdrawEpoch
    ? Math.min(100, ((state.withdrawEpoch - depositEpoch) / span) * 100)
    : undefined;

  return (
    <div className="epoch-timeline">
      <div className="timeline-labels">
        <span>Deposit <b>E{depositEpoch}</b></span>
        <span>Checkpoint <b>E{projectedClaim}</b></span>
      </div>
      <div className="timeline-track">
        <div className="cycle-fill" style={{ width: `${currentPosition}%` }} />
        <i className="deposit-pin" />
        {withdrawPosition !== undefined && (
          <i className="withdraw-pin" style={{ left: `${withdrawPosition}%` }} title="Phase-one request" />
        )}
        <i className="current-pin" style={{ left: `${currentPosition}%` }}>
          <span>NOW / E{current}</span>
        </i>
        <i className="checkpoint-pin" />
      </div>
      <div className="timeline-scale">
        <span>0</span><span>45</span><span>90</span><span>135</span><span>{span} epochs</span>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(initialState);
  const [amount, setAmount] = useState("10000");
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [showFormula, setShowFormula] = useState(false);

  const reward = compensation(state);
  const estimatedTotal =
    state.phase === "wallet" ? ckb(Number(amount) || 0) : state.depositCapacity + reward;
  const epochsElapsed = Math.max(0, state.currentEpoch - state.depositEpoch);
  const nextCheckpoint =
    state.phase === "wallet" || state.currentEpoch <= state.depositEpoch
      ? state.depositEpoch + LOCK_PERIOD_EPOCHS
      : state.claimEpoch ?? nextClaimEpoch(state.depositEpoch, state.currentEpoch);
  const epochsRemaining = Math.max(0, (state.claimEpoch ?? nextCheckpoint) - state.currentEpoch);
  const copy = phaseCopy[state.phase];

  const projectedReward = useMemo(() => {
    if (state.phase === "wallet") return 0n;
    return reward;
  }, [reward, state.phase]);

  const perform = (action: () => DaoState, title: string, detail: (next: DaoState) => string) => {
    try {
      const next = action();
      setState(next);
      setEvents((items) => [{ epoch: next.currentEpoch, title, detail: detail(next) }, ...items]);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const handleDeposit = () =>
    perform(
      () => deposit(state, ckb(Number(amount))),
      "Deposit committed",
      (next) => `${formatCkb(next.depositCapacity)} CKB entered a DAO cell`,
    );

  const handleAdvance = (epochs: number) =>
    perform(
      () => advanceEpochs(state, epochs),
      `Advanced ${epochs} epoch${epochs === 1 ? "" : "s"}`,
      (next) => `Chain tip is now epoch ${next.currentEpoch}`,
    );

  const handleRequest = () =>
    perform(
      () => requestWithdrawal(state),
      "Phase-one redemption",
      (next) => `Compensation frozen; claim epoch set to ${next.claimEpoch}`,
    );

  const handleFinalize = () =>
    perform(
      () => finalizeWithdrawal(state),
      "Withdrawal finalized",
      (next) => `${formatCkb(next.wallet)} CKB is now liquid`,
    );

  const reset = () => {
    setState(initialState());
    setEvents([]);
    setError("");
  };

  return (
    <main>
      <header>
        <a className="wordmark" href="#">
          <span className="mark"><i /><i /><i /></span>
          <span><strong>DAO</strong> OBSERVATORY</span>
        </a>
        <div className="header-meta">
          <span><i className="online" /> PROTOCOL SIMULATION</span>
          <a href="https://github.com/nervosnetwork/ckb-system-scripts/blob/master/c/dao.c" target="_blank" rel="noreferrer">
            VIEW DAO.C ↗
          </a>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="overline">NERVOS DAO / CELL LIFECYCLE INSTRUMENT</p>
          <h1>Watch monetary<br />policy become <em>capacity.</em></h1>
        </div>
        <p className="intro-copy">
          A working model of the Nervos DAO's two-phase withdrawal, 180-epoch
          checkpoints, and accumulate-rate compensation. Every state transition
          maps back to the system script.
        </p>
      </section>

      <section className="top-readings">
        <div><span>WALLET</span><strong>{formatCkb(state.wallet)} <small>CKB</small></strong></div>
        <div><span>DAO POSITION</span><strong>{formatCkb(state.depositCapacity)} <small>CKB</small></strong></div>
        <div className="accent-reading"><span>COMPENSATION</span><strong>+{formatCkb(projectedReward, 4)} <small>CKB</small></strong></div>
        <div><span>CHAIN TIP</span><strong>EPOCH {state.currentEpoch}</strong></div>
      </section>

      <section className="instrument">
        <div className="visual-column">
          <div className="section-heading">
            <div><span>01 / CELL STATE</span><h2>{copy.title}</h2></div>
            <span className="phase-index">{["wallet", "deposited", "withdrawing", "withdrawn"].indexOf(state.phase) + 1} / 4</span>
          </div>
          <CellDiagram state={state} />
          <div className="timeline-panel">
            <div className="timeline-heading">
              <span>180-EPOCH LOCK GEOMETRY</span>
              <span>{epochsElapsed} epochs observed</span>
            </div>
            <Timeline state={state} />
          </div>
        </div>

        <aside className="control-column">
          <div className="section-heading">
            <div><span>02 / CONTROL</span><h2>Advance the lifecycle</h2></div>
          </div>

          {state.phase === "wallet" && (
            <div className="action-block">
              <label htmlFor="amount">DEPOSIT AMOUNT</label>
              <div className="amount-input">
                <input id="amount" value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
                <span>CKB</span>
              </div>
              <div className="preset-row">
                {[1000, 10000, 20000].map((value) => (
                  <button type="button" key={value} onClick={() => setAmount(String(value))}>{value.toLocaleString()}</button>
                ))}
              </div>
              <div className="transaction-preview">
                <div><span>Output type</span><code>NervosDao / 0x</code></div>
                <div><span>Output data</span><code>00 00 00 00 00 00 00 00</code></div>
                <div><span>Occupied</span><code>102.00 CKB</code></div>
              </div>
              <button className="primary-action" type="button" onClick={handleDeposit}>Create deposit cell <span>→</span></button>
            </div>
          )}

          {state.phase === "deposited" && (
            <div className="action-block">
              <div className="signal-box">
                <span>ACCRUAL ACTIVE</span>
                <strong>AR {shortAr(arAtEpoch(state, state.currentEpoch))}</strong>
                <p>Only {formatCkb(state.depositCapacity - state.occupiedCapacity)} CKB of unoccupied capacity earns compensation.</p>
              </div>
              <label>MOVE THE CHAIN TIP</label>
              <div className="advance-grid">
                {[1, 30, 90, 180].map((value) => (
                  <button type="button" key={value} onClick={() => handleAdvance(value)}>+{value}<small>epochs</small></button>
                ))}
              </div>
              <div className="timing-advice">
                <span>NEXT CHECKPOINT</span>
                <strong>Epoch {nextCheckpoint}</strong>
                <p>Requesting now freezes +{formatCkb(reward, 4)} CKB and waits {nextCheckpoint - state.currentEpoch} more epochs.</p>
              </div>
              <button className="primary-action warm" type="button" onClick={handleRequest}>Begin phase-one redemption <span>→</span></button>
            </div>
          )}

          {state.phase === "withdrawing" && (
            <div className="action-block">
              <div className="signal-box warm-box">
                <span>COMPENSATION FROZEN</span>
                <strong>+{formatCkb(reward, 6)} CKB</strong>
                <p>The phase-one header fixed the withdrawal accumulate rate. Waiting now adds no compensation.</p>
              </div>
              <div className="countdown">
                <small>ABSOLUTE EPOCH SINCE</small>
                <strong>{state.claimEpoch}</strong>
                <span>{epochsRemaining === 0 ? "MATURE" : `${epochsRemaining} epochs remaining`}</span>
              </div>
              {epochsRemaining > 0 && (
                <div className="advance-grid">
                  {[1, Math.min(30, epochsRemaining), epochsRemaining].filter((value, index, values) => value > 0 && values.indexOf(value) === index).map((value) => (
                    <button type="button" key={value} onClick={() => handleAdvance(value)}>+{value}<small>epochs</small></button>
                  ))}
                </div>
              )}
              <button className="primary-action" type="button" disabled={epochsRemaining > 0} onClick={handleFinalize}>
                {epochsRemaining > 0 ? "Waiting for checkpoint" : "Release capacity"} <span>→</span>
              </button>
            </div>
          )}

          {state.phase === "withdrawn" && (
            <div className="action-block completion-block">
              <span className="complete-ring">✓</span>
              <p className="overline">LIFECYCLE COMPLETE</p>
              <h3>{formatCkb(estimatedTotal, 4)} CKB released</h3>
              <p>The DAO type cell was consumed. Principal and compensation now sit in an ordinary wallet cell.</p>
              <button className="primary-action" type="button" onClick={reset}>Run another observation <span>↻</span></button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </aside>
      </section>

      <section className="lower-deck">
        <article className="formula-panel">
          <div className="section-heading">
            <div><span>03 / COMPENSATION</span><h2>The capacity equation</h2></div>
            <button type="button" className="plain-button" onClick={() => setShowFormula(!showFormula)}>
              {showFormula ? "LESS" : "EXPAND"}
            </button>
          </div>
          <div className="equation">
            <span>occupied</span><b>+</b><span>(capacity − occupied)</span><b>×</b>
            <span className="fraction"><i>withdraw AR</i><i>deposit AR</i></span>
          </div>
          <p>
            The script protects occupied storage capacity, then scales only the
            remaining capacity by the ratio of DAO accumulate rates.
          </p>
          {showFormula && (
            <div className="formula-values">
              <code>occupied = {formatCkb(state.occupiedCapacity)} CKB</code>
              <code>deposit_AR = {state.depositAr ? shortAr(state.depositAr) : "waiting"}</code>
              <code>withdraw_AR = {state.withdrawAr ? shortAr(state.withdrawAr) : "set in phase one"}</code>
            </div>
          )}
        </article>

        <article className="gates-panel">
          <div className="section-heading">
            <div><span>04 / DAO.C</span><h2>Validation gates</h2></div>
            <span className="source-chip">589 LOC / C</span>
          </div>
          <div className="gate-list">
            {protocolGates.map((gate) => {
              const active = gate.activeIn.includes(state.phase);
              return (
                <div className={`gate ${active ? "active" : ""}`} key={gate.title}>
                  <span className="gate-light" />
                  <div><strong>{gate.title}</strong><code>{gate.symbol}</code></div>
                  <span>{gate.source}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="journal">
        <div className="section-heading">
          <div><span>05 / TRACE</span><h2>Observation log</h2></div>
          {events.length > 0 && <button type="button" className="plain-button" onClick={reset}>RESET</button>}
        </div>
        {events.length === 0 ? (
          <p className="empty-log">No transitions recorded. Create a deposit cell to begin.</p>
        ) : (
          <div className="event-list">
            {events.map((event, index) => (
              <div key={`${event.title}-${index}`}>
                <span>E{event.epoch}</span><i /><strong>{event.title}</strong><p>{event.detail}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer>
        <span>EDUCATIONAL MODEL / NO WALLET CONNECTION / ILLUSTRATIVE AR GROWTH</span>
        <div>
          <a href="https://github.com/ckb-devrel/nervdao" target="_blank" rel="noreferrer">NERVDAO ↗</a>
          <a href="https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md" target="_blank" rel="noreferrer">RFC 0023 ↗</a>
        </div>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
