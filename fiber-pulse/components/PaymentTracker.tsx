"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PaymentStatusReceipt } from "@/lib/payment-proof";

export function PaymentTracker({
  trackingId,
  initialStatus,
  onUpdate,
}: {
  trackingId: string;
  initialStatus?: string;
  onUpdate: (receipt: PaymentStatusReceipt) => void;
}) {
  const [status, setStatus] = useState(initialStatus ?? "submitted");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const checkingRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const refresh = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError(undefined);
    try {
      const response = await fetch("/api/fiber/payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingId }),
      });
      const body = (await response.json()) as PaymentStatusReceipt & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Payment status check failed.");
      setStatus(body.status);
      onUpdateRef.current(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment status check failed.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [trackingId]);

  const normalized = status.toUpperCase();
  const terminal = normalized === "SUCCESS" || normalized === "FAILED";
  const color = normalized === "SUCCESS" ? "var(--lime)" : normalized === "FAILED" ? "var(--ember)" : "#f0c24b";

  useEffect(() => {
    if (terminal) return;
    const first = window.setTimeout(() => void refresh(), 1000);
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [refresh, terminal]);

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: 14,
        border: "1px solid color-mix(in srgb, var(--lime) 22%, var(--line))",
        borderRadius: 14,
        background: "rgba(0, 0, 0, 0.16)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 3 }}>
          <span style={{ color: "var(--mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>
            Durable payment status
          </span>
          <strong style={{ color, fontFamily: "var(--font-mono)", fontSize: 13 }}>{status}</strong>
        </div>
        {!terminal && (
          <button
            type="button"
            disabled={checking}
            onClick={() => void refresh()}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "8px 12px",
              background: "transparent",
              color: "var(--fog)",
              cursor: checking ? "wait" : "pointer",
              opacity: checking ? 0.6 : 1,
            }}
          >
            {checking ? "Checking..." : "Check final status"}
          </button>
        )}
      </div>
      <code style={{ color: "var(--mute)", fontSize: 11, overflowWrap: "anywhere" }}>
        track:{trackingId}
      </code>
      {error && <span style={{ color: "var(--ember)", fontSize: 12 }}>{error}</span>}
      <span style={{ color: "var(--mute)", fontSize: 11, lineHeight: 1.4 }}>
        {terminal ? "Final state recorded." : "Auto-checking while this page is open. "}
        This opaque ID can resume status checks after a refresh. It does not reveal the node RPC or full payment hash.
      </span>
    </div>
  );
}
