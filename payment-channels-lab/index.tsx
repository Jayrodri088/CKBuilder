import React, { useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { STACK_COMPARISON } from "./lib/channel-model";
import {
  DEFAULT_FIBER_RPC,
  getNodeInfo,
  listChannels,
  type ChannelListItem,
} from "./lib/fiber-rpc";
import {
  createChannel,
  closeChannel,
  payOffChain,
  summarize,
  type ChannelSimulator,
  type Party,
} from "./lib/simulator";

function App() {
  const [channel, setChannel] = useState<ChannelSimulator | null>(null);
  const [fundingCkb, setFundingCkb] = useState("500");
  const [payAmount, setPayAmount] = useState("100");
  const [payer, setPayer] = useState<Party>("alice");
  const [log, setLog] = useState<string[]>([]);
  const [fiberUrl, setFiberUrl] = useState(DEFAULT_FIBER_RPC);
  const [fiberStatus, setFiberStatus] = useState<string>("");
  const [fiberChannels, setFiberChannels] = useState<ChannelListItem[]>([]);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 40));
  }, []);

  const openChannel = () => {
    try {
      const ch = createChannel(Number(fundingCkb));
      setChannel(ch);
      pushLog(`Opened channel: funding ${fundingCkb} CKB (1 on-chain tx)`);
      pushLog(`State: ${ch.state}`);
    } catch (e) {
      pushLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const pay = () => {
    if (!channel) return;
    try {
      const to: Party = payer === "alice" ? "bob" : "alice";
      const next = payOffChain(channel, payer, to, Number(payAmount));
      setChannel(next);
      pushLog(
        `Off-chain: ${payer} -> ${to} ${payAmount} CKB (no new L1 tx; total off-chain: ${next.payments.length})`,
      );
    } catch (e) {
      pushLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const close = () => {
    if (!channel) return;
    try {
      const { channel: closed, settlement } = closeChannel(channel);
      setChannel(closed);
      pushLog(
        `Closed channel (1 on-chain settlement tx). Alice ${Number(settlement.aliceReceives) / 1e8} CKB, Bob ${Number(settlement.bobReceives) / 1e8} CKB`,
      );
    } catch (e) {
      pushLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const probeFiber = async () => {
    setFiberStatus("Probing…");
    try {
      const info = await getNodeInfo({ url: fiberUrl });
      const ch = await listChannels({ url: fiberUrl });
      setFiberChannels(ch.channels ?? []);
      setFiberStatus(`Connected — ${info.chain ?? "fiber"} ${info.version ?? ""}`);
      pushLog(`Fiber RPC OK at ${fiberUrl}`);
    } catch (e) {
      setFiberChannels([]);
      setFiberStatus(`Unavailable: ${e instanceof Error ? e.message : String(e)}`);
      pushLog("Fiber RPC not reachable (start fnn per Fiber docs)");
    }
  };

  const summary = useMemo(() => (channel ? summarize(channel) : null), [channel]);

  const aliceCkb = summary ? Number(summary.localCkb) : Number(fundingCkb);
  const bobCkb = summary ? Number(summary.remoteCkb) : 0;

  return (
    <main>
      <span className="badge">CKB scaling · payment channels</span>
      <h1>Payment Channels Lab</h1>
      <p className="subtitle">
        CKB L1 is optimized for verification. High-throughput payments move to channel networks
        like <strong>Fiber</strong> (CKB&apos;s main PCN) and <strong>Perun</strong> (general
        state-channel framework). This app models open → off-chain pay → close, and optionally
        probes a live Fiber node over JSON-RPC.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Interactive channel (Alice ↔ Bob)</h2>
          <p style={{ fontSize: "0.85rem", color: "#94a8c4", margin: 0 }}>
            Mirrors Fiber&apos;s flow: fund on L1, many instant off-chain updates, settle on
            close.
          </p>

          <div className="channel-viz">
            <div className="party">
              <span>Alice (local)</span>
              <strong>{aliceCkb} CKB</strong>
            </div>
            <div className="pipe off-chain">
              off-chain
              <br />
              channel
            </div>
            <div className="party">
              <span>Bob (remote)</span>
              <strong>{bobCkb} CKB</strong>
            </div>
          </div>

          {summary && (
            <p>
              State: <span className="state-pill">{summary.state}</span> · On-chain txs:{" "}
              {summary.onChainTxCount} · Off-chain payments: {summary.offChainPayments}
            </p>
          )}

          <label htmlFor="funding">Funding (CKB, L1 lock)</label>
          <input
            id="funding"
            type="number"
            min={61}
            value={fundingCkb}
            onChange={(e) => setFundingCkb(e.target.value)}
            disabled={!!channel && channel.state !== "Closed"}
          />

          {!channel || channel.state === "Closed" ? (
            <button type="button" className="primary" onClick={openChannel}>
              Open channel
            </button>
          ) : (
            <>
              <label htmlFor="payer">Payer</label>
              <select
                id="payer"
                value={payer}
                onChange={(e) => setPayer(e.target.value as Party)}
                disabled={channel.state !== "ChannelReady"}
              >
                <option value="alice">Alice</option>
                <option value="bob">Bob</option>
              </select>
              <label htmlFor="amount">Amount (CKB)</label>
              <input
                id="amount"
                type="number"
                min={0.00000001}
                step={0.01}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                disabled={channel.state !== "ChannelReady"}
              />
              <button
                type="button"
                className="primary"
                onClick={pay}
                disabled={channel.state !== "ChannelReady"}
              >
                Pay off-chain
              </button>
              <button
                type="button"
                className="secondary"
                onClick={close}
                disabled={channel.state !== "ChannelReady"}
              >
                Close &amp; settle on L1
              </button>
            </>
          )}

          <div className="log" aria-live="polite">
            {log.length === 0 ? (
              <div>Event log will appear here.</div>
            ) : (
              log.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </section>

        <section className="card">
          <h2>Live Fiber node (optional)</h2>
          <p className="fiber-live" style={{ marginTop: 0 }}>
            Same RPC flow as the official basic-transfer guide:{" "}
            <code>node_info</code>, <code>list_channels</code>.
          </p>
          <label htmlFor="rpc">Fiber JSON-RPC URL</label>
          <input
            id="rpc"
            value={fiberUrl}
            onChange={(e) => setFiberUrl(e.target.value)}
            placeholder="http://127.0.0.1:8227"
          />
          <button type="button" className="primary" onClick={() => void probeFiber()}>
            Probe Fiber RPC
          </button>
          <p className={`fiber-live ${fiberStatus.startsWith("Connected") ? "ok" : "err"}`}>
            {fiberStatus || "—"}
          </p>
          {fiberChannels.length > 0 && (
            <ul style={{ fontSize: "0.8rem", paddingLeft: "1.2rem" }}>
              {fiberChannels.slice(0, 4).map((c) => (
                <li key={c.channel_id}>
                  {c.state_name} — local {c.local_balance} / remote {c.remote_balance}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: "1.25rem" }}>
        <h2>L1 vs Fiber vs Perun</h2>
        <table className="compare">
          <thead>
            <tr>
              <th>Approach</th>
              <th>Layer</th>
              <th>Settlement</th>
              <th>CKB role</th>
            </tr>
          </thead>
          <tbody>
            {STACK_COMPARISON.map((row) => (
              <tr key={row.kind}>
                <td>
                  <strong>{row.kind === "fiber" ? "Fiber" : row.kind === "perun" ? "Perun" : "L1 only"}</strong>
                </td>
                <td>{row.layer}</td>
                <td>{row.settlement}</td>
                <td>{row.ckbRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="links">
        <a href="https://www.fiber.world/docs" target="_blank" rel="noreferrer">
          Fiber docs
        </a>
        <a href="https://docs.fiber.world/docs/quick-start/basic-transfer" target="_blank" rel="noreferrer">
          Basic transfer
        </a>
        <a href="https://www.fiber.world/showcase" target="_blank" rel="noreferrer">
          Showcase
        </a>
      </p>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
