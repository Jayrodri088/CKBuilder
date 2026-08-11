"use client";

import {
  CSSProperties,
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PayMode, PaymentRequest, PreflightResult } from "@/lib/types";
import type { FiberSnapshot } from "@/lib/fiber-snapshot";
import type { PaymentProofReceipt } from "@/lib/payment-proof";
import { getRequest, listRequests, newId, saveRequest, updateRequest } from "@/lib/store";
import { runPreflight } from "@/lib/preflight";
import { mockSettleInvoice, mockStreamTick } from "@/lib/mock-fiber";
import {
  buildShareUrl,
  decodePayParam,
  payloadToRequest,
} from "@/lib/pay-codec";
import {
  loadMockNode,
  probeLiveNode,
  type MockNodeState,
} from "@/lib/mock-node";
import {
  buildL1HandoffUrl,
  fixesForPreflight,
  generatePreimage,
} from "@/lib/l1-fallback";
import {
  buildPayLinkClaimUrl,
  buildPayLinkPayerUrl,
  deriveLockAddress,
  scriptDeployed,
} from "@/lib/l1-lock";
import { L1FundMonitor } from "@/components/L1FundMonitor";
import {
  assertSessionAllows,
  loadSessionGrant,
  recordSessionSpend,
  remainingSessionCkb,
  resetSessionGrant,
  type SessionGrant,
} from "@/lib/session-grant";
import { QrCode } from "@/components/QrCode";
import { Countdown } from "@/components/Countdown";
import { ChannelStrip } from "@/components/ChannelStrip";

function PulseApp() {
  const router = useRouter();
  const params = useSearchParams();
  const payId = params.get("pay");
  const payPayload = params.get("p");

  const [label, setLabel] = useState("Coffee");
  const [amountCkb, setAmountCkb] = useState("2.5");
  const [mode, setMode] = useState<PayMode>("invoice");
  const [streamCap, setStreamCap] = useState("1");
  const [tickCkb, setTickCkb] = useState("0.05");
  const [tryLive, setTryLive] = useState(false);
  const [liveOk, setLiveOk] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<FiberSnapshot>();
  const [shareUrl, setShareUrl] = useState("");
  const [recent, setRecent] = useState<PaymentRequest[]>([]);
  const [active, setActive] = useState<PaymentRequest | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [node, setNode] = useState<MockNodeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [settleMs, setSettleMs] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [receiptId, setReceiptId] = useState<string>();
  const [liveReceipt, setLiveReceipt] = useState<PaymentProofReceipt>();
  const [operatorMode, setOperatorMode] = useState(false);
  const [operatorToken, setOperatorToken] = useState("");
  const [sessionCap, setSessionCapInput] = useState("20");
  const [session, setSession] = useState<SessionGrant | null>(null);
  const [l1Copied, setL1Copied] = useState(false);
  const [l1ClaimUrl, setL1ClaimUrl] = useState<string>();

  const refreshNode = useCallback(() => {
    setNode(loadMockNode());
  }, []);

  useEffect(() => {
    refreshNode();
    setRecent(listRequests());
    setSession(loadSessionGrant());
  }, [refreshNode, shareUrl, settleMs, active?.status, active?.streamedCkb]);

  useEffect(() => {
    if (!payId && !payPayload) {
      setActive(null);
      setPreflight(null);
      setSettleMs(null);
      setReceiptId(undefined);
      setLiveReceipt(undefined);
      return;
    }

    let req: PaymentRequest | undefined;
    if (payPayload) {
      const decoded = decodePayParam(payPayload);
      if (!decoded) {
        setError("Invalid payment link.");
        setActive(null);
        return;
      }
      const existing = getRequest(decoded.id);
      req = existing ?? payloadToRequest(decoded);
    } else if (payId) {
      req = getRequest(payId);
      if (!req) {
        setError("Payment link not found on this device. Use a full share link (?p=…).");
        setActive(null);
        return;
      }
    }

    if (!req) return;
    setError(undefined);
    setActive(req);
    if (req.l1Preimage && req.l1LockAddress) {
      setL1ClaimUrl(
        buildPayLinkClaimUrl({
          preimage: req.l1Preimage,
          amount: String(req.amountCkb),
          label: req.label,
          address: req.l1LockAddress,
        }),
      );
    } else {
      setL1ClaimUrl(undefined);
    }
    void (async () => {
      const pf = await runPreflight(req!, { tryLive });
      setPreflight(pf);
    })();
  }, [payId, payPayload, tryLive]);

  useEffect(() => {
    if (!tryLive) {
      setLiveOk(false);
      setLiveSnapshot(undefined);
      return;
    }
    void probeLiveNode().then((result) => {
      setLiveOk(result.ok);
      setLiveSnapshot(result.snapshot);
    });
  }, [tryLive]);

  const badge = tryLive && liveOk ? "LIVE" : "MOCK";

  const confidenceColor = useMemo(() => {
    if (!preflight) return "var(--mute)";
    if (preflight.level === "high") return "var(--lime)";
    if (preflight.level === "medium") return "#f0c24b";
    if (preflight.level === "low") return "var(--ember)";
    return "#ff3b3b";
  }, [preflight]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const amount = Number(amountCkb);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid CKB amount.");
      return;
    }
    const id = newId();
    const now = Date.now();
    const req: PaymentRequest = {
      id,
      label: label.trim() || "Payment",
      amountCkb: amount,
      mode,
      rail: "fiber",
      streamCapCkb: mode === "stream" ? Number(streamCap) || amount : undefined,
      tickCkb: mode === "stream" ? Number(tickCkb) || 0.05 : undefined,
      createdAt: now,
      expiresAt: now + 30 * 60_000,
      status: "open",
      streamedCkb: 0,
    };
    saveRequest(req);
    const url = buildShareUrl(window.location.origin, req);
    setShareUrl(url);
    setRecent(listRequests());
  }

  function applySessionCap() {
    const n = Number(sessionCap);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Session cap must be a positive CKB amount.");
      return;
    }
    setSession(resetSessionGrant(n));
    setError(undefined);
  }

  function switchToL1Rail() {
    if (!active) return;
    setError(undefined);
    const preimage = active.l1Preimage ?? generatePreimage();
    const handoff = buildL1HandoffUrl(active, preimage);
    let lockAddress: string | undefined;
    let hash: string | undefined;
    let payerUrl: string | undefined;
    let claimUrl: string | undefined;
    try {
      if (!scriptDeployed()) {
        throw new Error("hash-lock deployment missing — sync from ckb-pay-link");
      }
      const derived = deriveLockAddress(preimage);
      lockAddress = derived.address;
      hash = derived.hash;
      payerUrl = buildPayLinkPayerUrl({
        address: derived.address,
        amount: String(active.amountCkb),
        label: active.label,
      });
      claimUrl = buildPayLinkClaimUrl({
        preimage,
        amount: String(active.amountCkb),
        label: active.label,
        address: derived.address,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} (create-tab handoff still available)`
          : "L1 derive failed",
      );
    }
    const next: PaymentRequest = {
      ...active,
      rail: "l1",
      status: "l1_handoff",
      l1Preimage: preimage,
      l1HandoffUrl: handoff,
      l1LockAddress: lockAddress,
      l1Hash: hash,
      l1PayerUrl: payerUrl,
    };
    saveRequest(next);
    setActive(next);
    setL1ClaimUrl(claimUrl);
  }

  async function onPay() {
    if (!active || !preflight?.canPay) return;
    const spend =
      active.mode === "stream" ? (active.streamCapCkb ?? active.amountCkb) : active.amountCkb;
    const sessionErr = assertSessionAllows(
      active.mode === "stream" ? (active.tickCkb ?? 0.05) : spend,
    );
    if (sessionErr) {
      setError(sessionErr);
      return;
    }
    setBusy(true);
    setError(undefined);
    setLiveReceipt(undefined);
    try {
      if (preflight.source === "live") {
        if (active.mode === "stream") {
          throw new Error("Live stream execution is not enabled yet. Use an invoice or explicit mock mode.");
        }
        const response = await fetch("/api/fiber/payment", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(operatorMode && operatorToken
              ? { authorization: `Bearer ${operatorToken}` }
              : {}),
          },
          body: JSON.stringify({
            amountCkb: active.amountCkb,
            requestId: active.id,
            execute: operatorMode,
          }),
        });
        const result = (await response.json()) as PaymentProofReceipt & { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? `Fiber payment request failed (${response.status})`);
        }
        setLiveReceipt(result);
        setReceiptId(result.paymentHash ?? active.id);

        if (result.mode === "executed" && result.settled) {
          const paid: PaymentRequest = {
            ...active,
            status: "paid",
            paidAt: Date.now(),
            rail: "fiber",
          };
          saveRequest(paid);
          setActive(paid);
          setSession(recordSessionSpend(active.amountCkb));
        }
        return;
      }

      if (active.mode === "stream") {
        let current: PaymentRequest = {
          ...active,
          status: "streaming",
        };
        saveRequest(current);
        setActive(current);
        while (current.status === "streaming" || current.status === "open") {
          const tick = await mockStreamTick(current);
          const fromStore = getRequest(current.id);
          current = fromStore
            ? { ...fromStore }
            : {
                ...current,
                streamedCkb: tick.streamed,
                status: tick.done ? "capped" : "streaming",
              };
          setActive(current);
          setSettleMs(tick.ms);
          refreshNode();
          if (tick.done) break;
          const tickErr = assertSessionAllows(active.tickCkb ?? 0.05);
          if (tickErr) {
            setError(tickErr);
            break;
          }
          setSession(recordSessionSpend(active.tickCkb ?? 0.05));
        }
        setReceiptId(current.id);
      } else {
        const result = await mockSettleInvoice(active.id, active.amountCkb);
        if (!result.ok) throw new Error(result.error ?? "Settle failed");
        setSettleMs(result.ms);
        const paid: PaymentRequest = {
          ...active,
          status: "paid",
          paidAt: Date.now(),
          rail: "fiber",
        };
        saveRequest(paid);
        setActive(paid);
        setReceiptId(paid.id);
        setSession(recordSessionSpend(active.amountCkb));
        refreshNode();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  if ((payId || payPayload) && active) {
    const done = active.status === "paid" || active.status === "capped";
    const onL1 = active.rail === "l1" || active.status === "l1_handoff";
    const fixes = fixesForPreflight(active, preflight);
    return (
      <main style={styles.shell}>
        <header style={styles.top}>
          <button type="button" style={styles.ghostBtn} onClick={() => router.push("/")}>
            ← Pulse
          </button>
          <span style={styles.pill}>
            {badge} · {onL1 ? "L1 rail" : "Fiber rail"}
          </span>
        </header>

        <section style={styles.payStage} className="rise pay-stage">
          <div style={styles.orbit} className="pay-orbit">
            <div className="pulse-ring" />
            <div className="pulse-ring delay" />
            <div style={styles.orbCore}>
              <div style={styles.brandTiny}>PULSE</div>
              <div style={styles.payAmount}>
                {active.mode === "stream"
                  ? `${(active.streamedCkb ?? 0).toFixed(2)} / ${(active.streamCapCkb ?? active.amountCkb).toFixed(2)}`
                  : active.amountCkb}
                <span style={styles.unit}>CKB</span>
              </div>
              <div style={styles.payLabel}>{active.label}</div>
              <Countdown expiresAt={active.expiresAt} />
            </div>
          </div>

          <div style={styles.sheet} className="rise-2 pay-sheet">
            <div style={styles.sheetRow}>
              <span style={styles.mute}>Mode</span>
              <strong style={styles.mono}>
                {active.mode === "stream" ? "stream grant" : "invoice"}
              </strong>
            </div>
            <div style={styles.sheetRow}>
              <span style={styles.mute}>Status</span>
              <strong style={{ ...styles.mono, color: statusColor(active.status) }}>
                {active.status}
              </strong>
            </div>
            {preflight && (
              <>
                <div style={styles.sheetRow}>
                  <span style={styles.mute}>Preflight</span>
                  <strong style={{ ...styles.mono, color: confidenceColor }}>
                    {preflight.score}% · {preflight.level} · {preflight.latencyMs}ms
                  </strong>
                </div>
                <ul style={styles.reasons}>
                  {preflight.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            {fixes.length > 0 && !done && (
              <div style={styles.fixBox}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>
                  What to do next
                </strong>
                {fixes.map((f) => (
                  <div key={f.title} style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{f.title}</span>
                    <span style={{ ...styles.mute, fontSize: 12, lineHeight: 1.4 }}>
                      {f.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {settleMs != null && (
              <div style={styles.settleBanner} className="rise-3">
                Settled in <span style={styles.mono}>{settleMs}ms</span>
                {settleMs < 60 ? " — under 60ms." : "."}
              </div>
            )}
            {(done || liveReceipt) && receiptId && (
              <div style={styles.receipt}>
                <div style={styles.mute}>
                  {liveReceipt?.mode === "dry-run" ? "Route proof" : "Receipt"}
                </div>
                <code style={styles.mono}>
                  {liveReceipt ? `fiber:${receiptId}` : `pulse:${receiptId}`}
                </code>
                <div style={{ ...styles.mute, fontSize: 12 }}>
                  {liveReceipt
                    ? `${liveReceipt.mode} · ${liveReceipt.status} · ${liveReceipt.nextAction}`
                    : "Fiber mock rail · channel balances updated on this device"}
                </div>
              </div>
            )}
            {onL1 && active.l1Preimage && active.l1HandoffUrl && (
              <div style={styles.l1Box}>
                <strong style={{ fontFamily: "var(--font-display)" }}>L1 hash-lock rail</strong>
                {active.l1LockAddress ? (
                  <>
                    <p style={{ ...styles.mute, margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                      Live lock address derived on this device. Share the payer link /
                      QR with the payer — keep the preimage secret for claim.
                    </p>
                    <div
                      className="l1-rail-row"
                      style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}
                    >
                      <QrCode
                        value={
                          active.l1PayerUrl ??
                          `ckb:${active.l1LockAddress}?amount=${active.amountCkb}`
                        }
                        size={140}
                      />
                      <div style={{ flex: 1, minWidth: 180, display: "grid", gap: 6 }}>
                        <span style={styles.mute}>Lock address</span>
                        <code style={styles.shareCode}>{active.l1LockAddress}</code>
                        <span style={{ ...styles.mute, fontSize: 12 }}>
                          Amount {active.amountCkb} CKB · {active.label}
                          {active.amountCkb < 110
                            ? " · L1 cells need ≥110 CKB for this hash-lock"
                            : ""}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ ...styles.mute, margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    Address not derived here — open Pay Link create (prefilled) when
                    CKB + hash-lock deployment are available.
                  </p>
                )}
                {active.l1LockAddress && (
                  <L1FundMonitor
                    address={active.l1LockAddress}
                    amountCkb={active.amountCkb}
                  />
                )}
                <span style={styles.mute}>Merchant preimage (secret)</span>
                <code style={styles.shareCode}>{active.l1Preimage}</code>
                <div style={styles.actions} className="pay-sheet-actions">
                  <button
                    type="button"
                    style={styles.secondary}
                    onClick={() => {
                      void navigator.clipboard.writeText(active.l1Preimage!);
                      setL1Copied(true);
                      setTimeout(() => setL1Copied(false), 1200);
                    }}
                  >
                    {l1Copied ? "Copied secret" : "Copy preimage"}
                  </button>
                  {active.l1PayerUrl && (
                    <a
                      href={active.l1PayerUrl}
                      style={styles.secondary}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open payer view
                    </a>
                  )}
                  {l1ClaimUrl && (
                    <a
                      href={l1ClaimUrl}
                      style={styles.primary}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open claim
                    </a>
                  )}
                  <a href={active.l1HandoffUrl} style={styles.secondary} target="_blank" rel="noreferrer">
                    Open Pay Link create
                  </a>
                </div>
              </div>
            )}
            {error && <p style={styles.error}>{error}</p>}
            {preflight?.source === "live" && !onL1 && (
              <div style={styles.operatorBox}>
                <label style={styles.check}>
                  <input
                    type="checkbox"
                    checked={operatorMode}
                    onChange={(event) => setOperatorMode(event.target.checked)}
                  />
                  Trusted operator execution
                </label>
                {operatorMode && (
                  <input
                    type="password"
                    value={operatorToken}
                    onChange={(event) => setOperatorToken(event.target.value)}
                    placeholder="Temporary operator token"
                    autoComplete="off"
                    style={styles.input}
                  />
                )}
                <span style={{ ...styles.mute, fontSize: 11 }}>
                  Off runs a bounded dry-run proof. On can move testnet funds and requires server authorization.
                </span>
              </div>
            )}
            <div style={styles.actions}>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={tryLive}
                  onChange={(e) => setTryLive(e.target.checked)}
                />
                Probe live Fiber RPC
              </label>
              {!onL1 && (
                <button
                  type="button"
                  style={{
                    ...styles.primary,
                    opacity: busy || !preflight?.canPay || done ? 0.5 : 1,
                  }}
                  disabled={busy || !preflight?.canPay || done}
                  onClick={() => void onPay()}
                >
                  {done
                    ? "Paid"
                    : busy
                      ? "Checking Fiber..."
                      : preflight?.source === "live"
                        ? operatorMode
                          ? "Execute live payment"
                          : "Run live route proof"
                      : active.mode === "stream"
                        ? "Start stream"
                        : "Pay now"}
                </button>
              )}
            </div>

            <div style={styles.dualRail}>
              <strong style={{ fontFamily: "var(--font-display)" }}>Dual rail</strong>
              <p style={{ ...styles.mute, margin: 0, fontSize: 13, lineHeight: 1.45 }}>
                Fiber rail settles off-chain when capacity allows. If preflight blocks —
                or you choose backup — switch to the L1 hash-lock rail via Pay Link.
              </p>
              {!done && !onL1 && (
                <button type="button" style={styles.secondary} onClick={switchToL1Rail}>
                  Switch to L1 rail
                </button>
              )}
            </div>
          </div>

          {node && (
            <div style={{ width: "min(440px, 100%)" }} className="rise-3">
              <ChannelStrip node={node} badge={badge} snapshot={preflight?.snapshot ?? liveSnapshot} />
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main style={styles.shell}>
      <header style={styles.hero}>
        <div style={styles.heroGlow} aria-hidden />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="rise">
          <p style={styles.eyebrow}>Fiber · consumer pay track</p>
          <span style={styles.pill}>{badge}</span>
        </div>
        <h1 style={styles.brand} className="rise">
          PULSE
        </h1>
        <p style={styles.tagline} className="rise-2">
          Request. Preflight. Pay — settle that feels like sixty milliseconds.
        </p>
        <div style={styles.ctaRow} className="rise-3">
          <a href="#create" style={styles.primary}>
            Create a pay request
          </a>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={tryLive}
              onChange={(e) => setTryLive(e.target.checked)}
            />
            Prefer live Fiber probe
          </label>
        </div>
      </header>

      {node && (
        <div className="rise-2" style={{ marginBottom: 28 }}>
          <ChannelStrip node={node} badge={badge} snapshot={liveSnapshot} />
        </div>
      )}

      <section style={styles.sessionBar} className="rise-2">
        <div>
          <strong style={{ fontFamily: "var(--font-display)" }}>Session spend cap</strong>
          <p style={{ ...styles.mute, margin: "4px 0 0", fontSize: 12 }}>
            Approve a budget once for this browser. Pays stop when the cap is reached.
            {session
              ? ` Remaining ${remainingSessionCkb(session)} / ${session.maxTotalCkb} CKB.`
              : " No cap set yet."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={sessionCap}
            onChange={(e) => setSessionCapInput(e.target.value)}
            style={{ ...styles.input, width: 100 }}
            inputMode="decimal"
            aria-label="Session cap CKB"
          />
          <button type="button" style={styles.secondary} onClick={applySessionCap}>
            Set / reset cap
          </button>
        </div>
      </section>

      <section id="create" style={styles.create} className="rise-2">
        <form onSubmit={onCreate} style={styles.form}>
          <h2 style={styles.h2}>New payment</h2>
          <label style={styles.field}>
            <span>Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span>Amount (CKB)</span>
            <input
              value={amountCkb}
              onChange={(e) => setAmountCkb(e.target.value)}
              inputMode="decimal"
              style={styles.input}
            />
          </label>
          <div style={styles.modeRow}>
            <button
              type="button"
              style={mode === "invoice" ? styles.modeOn : styles.modeOff}
              onClick={() => setMode("invoice")}
            >
              Invoice
            </button>
            <button
              type="button"
              style={mode === "stream" ? styles.modeOn : styles.modeOff}
              onClick={() => setMode("stream")}
            >
              Stream (budgeted)
            </button>
          </div>
          {mode === "stream" && (
            <div style={styles.streamGrid}>
              <label style={styles.field}>
                <span>Cap (CKB)</span>
                <input
                  value={streamCap}
                  onChange={(e) => setStreamCap(e.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span>Tick (CKB)</span>
                <input
                  value={tickCkb}
                  onChange={(e) => setTickCkb(e.target.value)}
                  style={styles.input}
                />
              </label>
            </div>
          )}
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.primary}>
            Generate pay link
          </button>
        </form>

        {shareUrl && (
          <div style={styles.shareBox} className="rise-3">
            <div style={styles.mute}>Share link (works without creator storage)</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <QrCode value={shareUrl} size={160} />
              <div style={{ flex: 1, minWidth: 200, display: "grid", gap: 10 }}>
                <code style={styles.shareCode}>{shareUrl}</code>
                <div style={styles.actions}>
                  <button type="button" style={styles.secondary} onClick={() => void copyShare()}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() =>
                      router.push(shareUrl.replace(window.location.origin, ""))
                    }
                  >
                    Open as payer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section style={styles.recent}>
          <h2 style={styles.h2}>Recent on this device</h2>
          <ul style={styles.list}>
            {recent.slice(0, 6).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  style={styles.listItem}
                  onClick={() =>
                    router.push(
                      buildShareUrl(window.location.origin, r).replace(
                        window.location.origin,
                        "",
                      ),
                    )
                  }
                >
                  <span>
                    <strong>{r.label}</strong>
                    <span style={styles.mute}> · {r.mode}</span>
                  </span>
                  <span style={styles.mono}>
                    {r.amountCkb} CKB · {r.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={styles.footer}>
        August product track — mock settlement, live channel preflight, and bounded Fiber proof.
        Notes: <code style={styles.mono}>august-reports/WEEK2_REPORT.md</code>
      </footer>
    </main>
  );
}

function statusColor(status: PaymentRequest["status"]): string {
  if (status === "paid" || status === "capped") return "var(--lime)";
  if (status === "streaming" || status === "l1_handoff") return "#f0c24b";
  if (status === "expired") return "var(--ember)";
  return "var(--fog)";
}

const styles: Record<string, CSSProperties> = {
  shell: {
    maxWidth: 920,
    margin: "0 auto",
    padding: "28px 20px 64px",
    minHeight: "100vh",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  hero: {
    position: "relative",
    minHeight: "58vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    paddingBottom: 40,
    gap: 14,
  },
  heroGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    right: "8%",
    top: "12%",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(200,240,60,0.35) 0%, rgba(200,240,60,0.05) 45%, transparent 70%)",
    filter: "blur(2px)",
    pointerEvents: "none",
  },
  eyebrow: {
    margin: 0,
    color: "var(--mute)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 12,
    fontWeight: 500,
  },
  brand: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "clamp(4.5rem, 16vw, 8rem)",
    lineHeight: 0.9,
    letterSpacing: "-0.04em",
    color: "var(--fog)",
  },
  tagline: {
    margin: 0,
    maxWidth: 420,
    fontSize: 18,
    lineHeight: 1.45,
    color: "var(--mute)",
  },
  ctaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    marginTop: 10,
  },
  primary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 999,
    padding: "12px 22px",
    background: "var(--lime)",
    color: "#10140c",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondary: {
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: "12px 20px",
    background: "transparent",
    color: "var(--fog)",
    cursor: "pointer",
  },
  ghostBtn: {
    border: "none",
    background: "transparent",
    color: "var(--fog)",
    cursor: "pointer",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 18,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid var(--line)",
    color: "var(--mute)",
    fontSize: 12,
    letterSpacing: "0.04em",
  },
  create: {
    display: "grid",
    gap: 20,
    marginTop: 8,
  },
  form: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 24,
    background: "var(--glass)",
    border: "1px solid var(--line)",
    backdropFilter: "blur(10px)",
  },
  h2: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: 28,
    letterSpacing: "-0.02em",
  },
  field: {
    display: "grid",
    gap: 6,
    color: "var(--mute)",
    fontSize: 13,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid var(--line)",
    background: "var(--ink-2)",
    color: "var(--fog)",
    padding: "12px 14px",
    outline: "none",
  },
  modeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  modeOn: {
    border: "1px solid var(--lime)",
    background: "rgba(200,240,60,0.12)",
    color: "var(--lime)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
  },
  modeOff: {
    border: "1px solid var(--line)",
    background: "transparent",
    color: "var(--mute)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
  },
  streamGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  shareBox: {
    display: "grid",
    gap: 10,
    padding: 20,
    borderRadius: 20,
    border: "1px solid rgba(200,240,60,0.35)",
    background: "rgba(200,240,60,0.06)",
  },
  shareCode: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    wordBreak: "break-all",
    color: "var(--fog)",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  recent: {
    marginTop: 40,
    display: "grid",
    gap: 12,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: 8,
  },
  listItem: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid var(--line)",
    background: "var(--glass)",
    color: "var(--fog)",
    cursor: "pointer",
  },
  footer: {
    marginTop: 48,
    color: "var(--mute)",
    fontSize: 13,
    lineHeight: 1.5,
  },
  mute: { color: "var(--mute)" },
  mono: { fontFamily: "var(--font-mono)", fontSize: 13 },
  error: { color: "var(--ember)", margin: 0 },
  payStage: {
    display: "grid",
    gap: 28,
    justifyItems: "center",
  },
  orbit: {
    position: "relative",
    width: "min(320px, 80vw)",
    aspectRatio: "1",
    display: "grid",
    placeItems: "center",
  },
  orbCore: {
    width: "72%",
    aspectRatio: "1",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 6,
    background:
      "radial-gradient(circle at 35% 30%, rgba(200,240,60,0.22), transparent 45%), var(--ink-2)",
    border: "1px solid rgba(200,240,60,0.35)",
    boxShadow: "0 0 60px rgba(200,240,60,0.12)",
  },
  brandTiny: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    letterSpacing: "0.2em",
    fontSize: 11,
    color: "var(--lime)",
  },
  payAmount: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "clamp(2.2rem, 8vw, 3rem)",
    letterSpacing: "-0.03em",
  },
  unit: {
    display: "block",
    textAlign: "center",
    fontSize: 14,
    color: "var(--mute)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    letterSpacing: "0.08em",
  },
  payLabel: {
    color: "var(--mute)",
    fontSize: 14,
  },
  sheet: {
    width: "min(440px, 100%)",
    display: "grid",
    gap: 12,
    padding: 22,
    borderRadius: 24,
    background: "var(--glass)",
    border: "1px solid var(--line)",
  },
  sheetRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "baseline",
  },
  reasons: {
    margin: 0,
    paddingLeft: 18,
    color: "var(--mute)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  settleBanner: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(200,240,60,0.12)",
    border: "1px solid rgba(200,240,60,0.35)",
    color: "var(--lime)",
    fontWeight: 600,
  },
  receipt: {
    display: "grid",
    gap: 4,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--line)",
    background: "rgba(232,239,230,0.04)",
  },
  operatorBox: {
    display: "grid",
    gap: 9,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(240,194,75,0.35)",
    background: "rgba(240,194,75,0.06)",
  },
  dualRail: {
    display: "grid",
    gap: 10,
    paddingTop: 8,
    borderTop: "1px solid var(--line)",
  },
  fixBox: {
    display: "grid",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,90,54,0.35)",
    background: "rgba(255,90,54,0.08)",
  },
  l1Box: {
    display: "grid",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(240,194,75,0.4)",
    background: "rgba(240,194,75,0.08)",
  },
  sessionBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid var(--line)",
    background: "var(--glass)",
    marginBottom: 20,
  },
  check: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    color: "var(--mute)",
    fontSize: 13,
  },
};

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>Loading Pulse…</main>}>
      <PulseApp />
    </Suspense>
  );
}
