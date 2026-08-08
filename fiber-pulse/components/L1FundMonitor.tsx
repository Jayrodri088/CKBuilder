"use client";

import { useCallback, useEffect, useState } from "react";
import { capacityOf, fundStatus, shannonToCkb } from "@/lib/l1-lock";

export function L1FundMonitor({
  address,
  amountCkb,
}: {
  address: string;
  amountCkb: number;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const [updatedAt, setUpdatedAt] = useState<number>();

  const refresh = useCallback(async () => {
    if (!address) return;
    setChecking(true);
    setError(undefined);
    try {
      const cap = await capacityOf(address);
      setBalance(Number(shannonToCkb(cap)));
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Balance check failed");
      setBalance(null);
    } finally {
      setChecking(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const status = fundStatus(balance, amountCkb);
  const color =
    status === "funded" ? "var(--lime)" : status === "waiting" ? "#f0c24b" : "var(--mute)";

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${status === "funded" ? "rgba(200,240,60,0.4)" : "var(--line)"}`,
        background:
          status === "funded" ? "rgba(200,240,60,0.1)" : "rgba(232,239,230,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>
          Fund check
        </strong>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {status === "funded" ? "funded" : status === "waiting" ? "waiting" : "—"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--mute)" }}>Lock balance</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {balance == null ? "…" : `${balance} CKB`}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--mute)" }}>Needed</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{amountCkb} CKB</span>
      </div>
      {status === "funded" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--lime)", lineHeight: 1.4 }}>
          Enough capacity on the lock — open claim with the merchant preimage.
        </p>
      )}
      {status === "waiting" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--mute)", lineHeight: 1.4 }}>
          Waiting for funding. Devnet:{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
            offckb deposit &lt;lock&gt; {Math.max(320, Math.ceil(amountCkb + 110))}
          </code>{" "}
          (spare capacity helps claim leave a change cell).
        </p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ember)" }}>{error}</p>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--mute)" }}>
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleTimeString()}`
            : "Polling every 10s"}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={checking}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "6px 12px",
            background: "transparent",
            color: "var(--fog)",
            cursor: "pointer",
            fontSize: 12,
            opacity: checking ? 0.5 : 1,
          }}
        >
          {checking ? "Checking…" : "Check now"}
        </button>
      </div>
    </div>
  );
}
