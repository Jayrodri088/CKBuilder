"use client";

import React, { useCallback, useState } from "react";
import {
  DEFAULT_FIBER_RPC,
  fiberRpcUrlFromEnv,
  getNodeInfo,
  listChannels,
  shannonToCkbDisplay,
  type ChannelListItem,
  type NodeInfo,
} from "../lib/fiber-rpc";

export function FiberPanel() {
  const [fiberUrl, setFiberUrl] = useState(
    () => fiberRpcUrlFromEnv() || DEFAULT_FIBER_RPC,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState<NodeInfo | null>(null);
  const [channels, setChannels] = useState<ChannelListItem[]>([]);

  const probe = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      const node = await getNodeInfo(fiberUrl);
      const ch = await listChannels(fiberUrl);
      setInfo(node);
      setChannels(ch.channels ?? []);
      setStatus("ok");
      setMessage(
        `Connected — ${node.chain ?? "fiber"} ${node.version ?? ""}`.trim(),
      );
    } catch (e: unknown) {
      setInfo(null);
      setChannels([]);
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Fiber probe failed");
    }
  }, [fiberUrl]);

  const readyCount = channels.filter((c) => c.state_name === "ChannelReady").length;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-6">
        <h2 className="text-lg font-semibold text-white">Fiber (L2) — read-only</h2>
        <p className="mt-2 text-sm text-slate-300">
          Pay Link <strong className="text-white">payments</strong> use CKB L1
          hash-locks. This tab probes a Fiber node: channel list and balances. Phase
          B would add off-chain pay here.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs text-slate-400">
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <p className="font-medium text-slate-200">CKB L1 (this app)</p>
            <p className="mt-1">Fund lock address → claim with preimage</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
            <p className="font-medium text-violet-200">Fiber L2 (probe)</p>
            <p className="mt-1">Open channel on L1 → pay inside channel off-chain</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <label className="block text-sm text-slate-300">Fiber JSON-RPC URL</label>
        <input
          value={fiberUrl}
          onChange={(e) => setFiberUrl(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white"
        />
        <p className="mt-2 text-xs text-slate-500">
          CLI: <code className="text-slate-300">pnpm run fiber:status</code> · env{" "}
          <code className="text-slate-300">FIBER_RPC_URL</code>
        </p>
        <button
          type="button"
          onClick={() => void probe()}
          disabled={status === "loading"}
          className="mt-4 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {status === "loading" ? "Probing…" : "Probe Fiber node"}
        </button>

        {message && (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              status === "error"
                ? "border border-red-500/30 bg-red-950/40 text-red-200"
                : status === "ok"
                  ? "border border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
                  : "text-slate-400"
            }`}
          >
            {message}
          </p>
        )}

        {info && (
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Pubkey</span>{" "}
              <span className="break-all font-mono text-xs">{info.pubkey ?? "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Channels</span>{" "}
              {channels.length} total, {readyCount} ready
            </p>
          </div>
        )}

        {channels.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="py-2 pr-2">Channel</th>
                  <th className="py-2 pr-2">State</th>
                  <th className="py-2 pr-2">Local</th>
                  <th className="py-2">Remote</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr key={ch.channel_id} className="border-b border-white/5">
                    <td className="py-2 pr-2 font-mono">
                      {(ch.channel_id ?? "").slice(0, 14)}…
                    </td>
                    <td className="py-2 pr-2">{ch.state_name ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {shannonToCkbDisplay(ch.local_balance)}
                    </td>
                    <td className="py-2">
                      {shannonToCkbDisplay(ch.remote_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status === "ok" && channels.length === 0 && (
          <p className="mt-4 text-sm text-amber-200/90">
            No channels yet — open a channel on Fiber before L2 payments (Phase B).
          </p>
        )}
      </div>
    </section>
  );
}
