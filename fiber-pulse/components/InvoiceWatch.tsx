"use client";

import { useCallback, useEffect, useState } from "react";

type WatchResult = {
  status?: "open" | "paid" | "cancelled" | "expired" | "unknown";
  settled?: boolean;
  webhook?: {
    configured: boolean;
    eventId?: string;
    state: "disabled" | "misconfigured" | "pending" | "delivered" | "failed";
    attempts?: number;
    nextAttemptAt?: string;
  };
  error?: string;
};

export function InvoiceWatch({
  invoice,
  amountCkb,
  operatorToken,
}: {
  invoice: string;
  amountCkb: number;
  operatorToken?: string;
}) {
  const [result, setResult] = useState<WatchResult>();
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
      setResult({ status: body.status, settled: body.settled, webhook: body.webhook });
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

  async function cancel() {
    if (!operatorToken) {
      setResult((current) => ({
        ...current,
        error: "Enter the operator token to cancel this invoice.",
      }));
      return;
    }
    setCancelling(true);
    try {
      const response = await fetch("/api/fiber/invoice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${operatorToken}`,
        },
        body: JSON.stringify({ invoice, amountCkb, cancel: true }),
      });
      const body = await response.json();
      if (!response.ok || !body.valid) {
        setResult({ error: body.error ?? "Invoice cancel failed." });
        return;
      }
      setResult({ status: body.status, settled: body.settled });
    } catch {
      setResult({ error: "Fiber node could not cancel this invoice." });
    } finally {
      setCancelling(false);
    }
  }

  const status = result?.status ?? "unknown";
  const color =
    status === "paid"
      ? "var(--lime)"
      : status === "open"
        ? "#f0c24b"
        : status === "cancelled"
          ? "var(--ember)"
          : "var(--mute)";

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
          : status === "cancelled"
            ? "This invoice is cancelled and can no longer be paid."
            : "Polls the receiving Fiber node for this invoice. A second merchant node is required for a true cross-node settle."}
      </p>
      {result?.error && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ember)" }}>{result.error}</p>
      )}
      {status === "paid" && result?.webhook && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--line)",
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--mute)" }}>Order callback</span>
          <span
            style={{
              color:
                result.webhook.state === "delivered"
                  ? "var(--lime)"
                  : result.webhook.state === "failed" || result.webhook.state === "misconfigured"
                    ? "var(--ember)"
                    : "var(--mute)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
            }}
          >
            {result.webhook.state}
            {result.webhook.attempts ? ` / ${result.webhook.attempts}` : ""}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={checking || cancelling}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "6px 12px",
            background: "transparent",
            color: "var(--fog)",
            cursor: "pointer",
            fontSize: 12,
            opacity: checking || cancelling ? 0.5 : 1,
          }}
        >
          {checking ? "Checking…" : "Check now"}
        </button>
        {status === "open" && (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={cancelling}
            style={{
              border: "1px solid rgba(255,90,54,0.45)",
              borderRadius: 999,
              padding: "6px 12px",
              background: "transparent",
              color: "var(--ember)",
              cursor: "pointer",
              fontSize: 12,
              opacity: cancelling ? 0.5 : 1,
            }}
          >
            {cancelling ? "Cancelling…" : "Cancel invoice"}
          </button>
        )}
      </div>
    </div>
  );
}
