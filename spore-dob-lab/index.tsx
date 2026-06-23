import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { decodeDob, renderDobSvg } from "./lib/dob";
import {
  anatomyFor,
  ckb,
  createSpore,
  formatCkb,
  initialState,
  meltSpore,
  transferSpore,
  type Owner,
  type SporeState,
  type TxAnatomy,
} from "./lib/spore-model";
import { callSsriMethod, ssriMethods } from "./lib/ssri";
import "./styles.css";

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Anatomy({ anatomy }: { anatomy: TxAnatomy }) {
  return (
    <article className="anatomy">
      <div className="panel-title">
        <span>Transaction anatomy</span>
        <h3>{anatomy.title}</h3>
      </div>
      {(["inputs", "outputs", "cellDeps", "witnesses"] as const).map((key) => (
        <div className="anatomy-row" key={key}>
          <span>{key === "cellDeps" ? "cell_deps" : key}</span>
          <ul>
            {anatomy[key].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </article>
  );
}

function SporeCard({ state }: { state: SporeState }) {
  const cell = state.cell;
  if (!cell || cell.melted) {
    return (
      <section className="spore-empty">
        <div className="empty-ring" />
        <h2>{state.phase === "melted" ? "Spore melted" : "No live Spore yet"}</h2>
        <p>
          {state.phase === "melted"
            ? "The object cell was consumed and its capacity returned to the owner."
            : "Create a Spore-like cell to see content, capacity, lock, type, and DOB data come together."}
        </p>
      </section>
    );
  }

  return (
    <section className="spore-card">
      <div className="scan-lines" />
      <div className="cell-heading">
        <span>Live Spore cell</span>
        <code>{cell.id}</code>
      </div>
      <div className="cell-core">
        <span>Owner lock</span>
        <strong>{cell.owner}</strong>
        <small>{cell.transfers} transfer{cell.transfers === 1 ? "" : "s"}</small>
      </div>
      <div className="cell-fields">
        <div><span>capacity</span><code>{formatCkb(cell.capacity)} CKB</code></div>
        <div><span>occupied</span><code>{formatCkb(cell.occupiedCapacity)} CKB</code></div>
        <div><span>margin</span><code>{formatCkb(cell.capacityMargin, 6)} CKB</code></div>
        <div><span>type</span><code>{cell.typeScript}</code></div>
        <div><span>content</span><code>{cell.contentType}</code></div>
        <div><span>cluster</span><code>{cell.clusterId}</code></div>
        <div className="wide"><span>dna</span><code>{cell.dna}</code></div>
      </div>
    </section>
  );
}

function DobPreview({ dna }: { dna: string }) {
  const object = useMemo(() => decodeDob(dna), [dna]);
  const svg = useMemo(() => renderDobSvg(object), [object]);
  return (
    <article className="dob-panel">
      <div className="panel-title">
        <span>DOB/1 renderer</span>
        <h3>{object.pattern}</h3>
      </div>
      <div className="dob-layout">
        <div className="svg-frame" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="traits">
          <span className="decoder-chip">decoder: {object.decoder}</span>
          {object.traits.map((trait) => (
            <div key={trait.name}>
              <span>{trait.name}</span>
              <strong>{trait.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function SsriExplorer() {
  const [selected, setSelected] = useState(ssriMethods[0].path);
  const method = callSsriMethod(selected);
  return (
    <article className="ssri-panel">
      <div className="panel-title">
        <span>SSRI explorer</span>
        <h3>Script-sourced methods</h3>
      </div>
      <p>
        SSRI uses method paths to ask a script for structured information during
        off-chain execution. This lab uses deterministic demo paths for browser
        exploration; production SSRI paths use the CKB hash rule from the proposal.
      </p>
      <select value={selected} onChange={(event) => setSelected(event.target.value)}>
        {ssriMethods.map((item) => (
          <option value={item.path} key={item.signature}>
            {item.signature}
          </option>
        ))}
      </select>
      <div className="method-card">
        <span>method path</span>
        <code>{method.path}</code>
        <span>signature</span>
        <code>{method.signature}</code>
        <span>response</span>
        <strong>{method.response}</strong>
        <p>{method.description}</p>
      </div>
    </article>
  );
}

function App() {
  const [state, setState] = useState(initialState);
  const [dna, setDna] = useState("0x7ac19e455601ff0088aabbccddeeff00");
  const [backing, setBacking] = useState("500");
  const [margin, setMargin] = useState("1");
  const [error, setError] = useState("");
  const [action, setAction] = useState<"create" | "transfer" | "melt">("create");

  const activeDna = state.cell?.dna ?? dna;
  const anatomy = anatomyFor(state, action);
  const cellOwner = state.cell?.owner;
  const nextOwner: Owner = cellOwner === "issuer" ? "collector" : "issuer";

  const perform = (fn: () => SporeState, nextAction?: "create" | "transfer" | "melt") => {
    try {
      const next = fn();
      setState(next);
      setError("");
      if (nextAction) setAction(nextAction);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const totalLiveCapacity = state.cell && !state.cell.melted ? state.cell.capacity : 0n;

  return (
    <main>
      <header>
        <a className="brand" href="#">
          <i />
          <span>Spore DOB Observatory</span>
        </a>
        <nav>
          <a href="https://docs.spore.pro/" target="_blank" rel="noreferrer">Spore docs</a>
          <a href="https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256/2" target="_blank" rel="noreferrer">SSRI</a>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">CKB digital objects / offline lab</p>
        <h1>Cells that carry value, content, and meaning.</h1>
        <p>
          Create a Spore-like object, transfer it without changing identity, melt
          it back into CKB, decode DOB DNA, render traits, and inspect SSRI-style
          script metadata.
        </p>
      </section>

      <section className="metrics">
        <Metric label="Issuer wallet" value={`${formatCkb(state.wallets.issuer)} CKB`} />
        <Metric label="Collector wallet" value={`${formatCkb(state.wallets.collector)} CKB`} />
        <Metric label="Live Spore capacity" value={`${formatCkb(totalLiveCapacity)} CKB`} accent />
        <Metric label="Fees paid" value={`${formatCkb(state.feesPaid, 6)} CKB`} />
      </section>

      <section className="workbench">
        <div className="left">
          <SporeCard state={state} />
          <DobPreview dna={activeDna} />
        </div>

        <aside className="controls">
          <div className="panel-title">
            <span>Lifecycle controls</span>
            <h3>{state.phase}</h3>
          </div>

          {state.phase === "empty" && (
            <div className="form-block">
              <label htmlFor="dna">DOB DNA</label>
              <input id="dna" value={dna} onChange={(event) => setDna(event.target.value)} />
              <label htmlFor="backing">Intrinsic backing (CKB)</label>
              <input id="backing" value={backing} onChange={(event) => setBacking(event.target.value)} />
              <label htmlFor="margin">Capacity margin (CKB)</label>
              <input id="margin" value={margin} onChange={(event) => setMargin(event.target.value)} />
              <button
                type="button"
                className="primary"
                onClick={() =>
                  perform(
                    () =>
                      createSpore(state, {
                        dna,
                        backing: ckb(Number(backing)),
                        margin: ckb(Number(margin)),
                        contentType: "application/dob+json",
                      }),
                    "transfer",
                  )
                }
              >
                Create Spore cell
              </button>
            </div>
          )}

          {state.phase === "live" && state.cell && (
            <div className="form-block">
              <div className="notice">
                <span>Object identity</span>
                <strong>{state.cell.id}</strong>
                <p>The Spore id and DOB DNA remain stable while ownership moves.</p>
              </div>
              <button
                type="button"
                className="primary"
                onClick={() => perform(() => transferSpore(state, nextOwner), "transfer")}
              >
                Transfer to {nextOwner}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => perform(() => meltSpore(state), "melt")}
              >
                Melt into CKB
              </button>
            </div>
          )}

          {state.phase === "melted" && (
            <div className="form-block">
              <div className="notice done">
                <span>Redeemed</span>
                <strong>capacity returned</strong>
                <p>The object cell was consumed. The DOB content no longer has a live Spore carrier.</p>
              </div>
              <button type="button" className="primary" onClick={() => setState(initialState())}>
                Reset lab
              </button>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <Anatomy anatomy={anatomy} />
        </aside>
      </section>

      <section className="lower-grid">
        <SsriExplorer />
        <article className="journal">
          <div className="panel-title">
            <span>Trace</span>
            <h3>Observed events</h3>
          </div>
          {state.history.length === 0 ? (
            <p className="empty">No events yet. Create a Spore cell to begin.</p>
          ) : (
            <ol>
              {state.history.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ol>
          )}
        </article>
      </section>

      <footer>
        <span>Offline-first model. Not a wallet. Not a production Spore SDK transaction builder.</span>
        <span>capacity + content + decoder + script-sourced information</span>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
