"use client";

import type { MockNodeState } from "@/lib/mock-node";
import { totalReceiveCkb, totalSendCkb } from "@/lib/mock-node";
import type { FiberSnapshot } from "@/lib/fiber-snapshot";

export function ChannelStrip({
  node,
  badge,
  snapshot,
}: {
  node: MockNodeState;
  badge: "MOCK" | "LIVE";
  snapshot?: FiberSnapshot;
}) {
  const live = badge === "LIVE" ? snapshot : undefined;
  const channels = live
    ? live.channels.map((channel) => ({
        id: channel.id,
        peerShort: channel.peer,
        localCkb: channel.sendableCkb,
        remoteCkb: channel.receivableCkb,
        state: channel.state,
        connected: channel.connected,
        enabled: channel.enabled,
      }))
    : node.channels.map((channel) => ({ ...channel, connected: true, enabled: true }));
  const send = live ? live.maxSendableCkb : totalSendCkb(node);
  const recv = live ? live.maxReceivableCkb : totalReceiveCkb(node);
  const total = send + recv || 1;
  const sendPct = Math.round((send / total) * 100);

  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        padding: 18,
        borderRadius: 20,
        border: "1px solid var(--line)",
        background: "var(--glass)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <strong style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          Channel capacity
        </strong>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            padding: "4px 10px",
            borderRadius: 999,
            background: badge === "LIVE" ? "rgba(200,240,60,0.18)" : "rgba(255,90,54,0.18)",
            color: badge === "LIVE" ? "var(--lime)" : "var(--ember)",
            border: `1px solid ${badge === "LIVE" ? "rgba(200,240,60,0.4)" : "rgba(255,90,54,0.4)"}`,
          }}
        >
          {badge}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--mute)" }}>You can send</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{send.toFixed(2)} CKB</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--mute)" }}>You can receive</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{recv.toFixed(2)} CKB</span>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(232,239,230,0.08)",
          display: "flex",
        }}
      >
        <div style={{ width: `${sendPct}%`, background: "var(--lime)" }} />
        <div style={{ flex: 1, background: "rgba(232,239,230,0.25)" }} />
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {channels.map((c) => {
          const cap = c.localCkb + c.remoteCkb || 1;
          const localPct = Math.round((c.localCkb / cap) * 100);
          return (
            <li
              key={c.id}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid var(--line)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{c.id}</span>
                <span style={{ fontSize: 11, color: "var(--mute)" }}>
                  {c.state} · {!c.enabled ? "disabled" : c.connected ? c.peerShort : "peer offline"}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "rgba(232,239,230,0.08)",
                  display: "flex",
                }}
              >
                <div style={{ width: `${localPct}%`, background: "var(--lime-deep)" }} />
                <div style={{ flex: 1, background: "rgba(232,239,230,0.2)" }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
