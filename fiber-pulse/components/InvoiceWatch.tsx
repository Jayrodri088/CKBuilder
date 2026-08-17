"use client";

import { useCallback, useEffect, useState } from "react";

type WatchResult = {
  status?: "open" | "paid" | "cancelled" | "expired" | "unknown";
  settled?: boolean;
  error?: string;
};

export function InvoiceWatch({
  invoice,
  amountCkb,
}: {
  invoice: string;
  amountCkb: number;
}) {
  const [result, setResult] = useState<WatchResult>();
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/fiber/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoice, amountCkb, watch: true }),
      });
      const body = await response.json();
      if (!response.ok || !body.valid) {
        setResult({ error: body.error ?? "Invoice watch failed." });
        return;
      }
      setResult({ status: body.status, settled: body.settled });
    } catch {
      setResult({ error: "Fiber node could not be reached for invoice watch." });
    } finally {
      setChecking(false);
    }
  }, [amountCkb, invoice]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 8_000);
    return () => clearInterval(id);
  }, [refresh]);

  const status = result?.status ?? "unknown";
  const color =
    status === "paid" ? "var(--lime)" : status === "open" ? "#f0c24b" : "var(--mute)";

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${status === "paid" ? "rgba(200,240,60,0.4)" : "var(--line)"}`,
        background: status === "paid" ? "rgba(200,240,60,0.1)" : "rgba(232,239,230,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>
          Merchant settlement
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
          {status}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--mute)", lineHeight: 1.4 }}>
        {status === "paid"
          ? "FNN reports this invoice as paid on the receiving node."
          : "Polls the receiving Fiber node for this invoice. A second merchant node is required for a true cross-node settle."}
      </p>
      {result?.error && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ember)" }}>{result.error}</p>
      )}
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={checking}
        style={{
          justifySelf: "start",
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
  );
}
