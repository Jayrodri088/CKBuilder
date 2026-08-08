"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { hashCkb, hexFrom } from "@ckb-ccc/core";
import { currentNetwork } from "./ccc-client";
import {
  buildPayerUrl,
  capacityOf,
  claimPayment,
  generateAccount,
  generatePreimage,
  scriptDeployed,
  shannonToCKB,
  wait,
} from "./pay-link";
import { useSearchParams } from "next/navigation";
import { FiberPanel } from "./fiber-panel";

type Tab = "create" | "payer" | "claim" | "fiber";

function initialView(view: string | null): Tab {
  if (view === "payer" || view === "create" || view === "claim" || view === "fiber") {
    return view;
  }
  return "create";
}

function PayLinkApp() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => initialView(searchParams.get("view")));
  const [label, setLabel] = useState("Weekend invoice");
  const [preimage, setPreimage] = useState("Hello World");
  const [hash, setHash] = useState("");
  const [lockAddress, setLockAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [amountCkb, setAmountCkb] = useState("200");
  const [claimTo, setClaimTo] = useState(
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew",
  );
  const [payerLink, setPayerLink] = useState("");
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<string>();
  const [claiming, setClaiming] = useState(false);
  const [fromPulse, setFromPulse] = useState(false);

  const payerAddress = searchParams.get("address") ?? lockAddress;
  const payerAmount = searchParams.get("amount") ?? amountCkb;
  const payerLabel = searchParams.get("label") ?? label;

  // Prefill from Pulse: ?view=create|payer|claim&from=pulse&amount=&label=&preimage=&address=&claimTo=
  useEffect(() => {
    const view = searchParams.get("view");
    setTab(initialView(view));
    if (searchParams.get("from") === "pulse") setFromPulse(true);
    const qAmount = searchParams.get("amount");
    const qLabel = searchParams.get("label");
    const qPreimage = searchParams.get("preimage");
    const qClaimTo = searchParams.get("claimTo");
    const qAddress = searchParams.get("address");
    if (qAmount) setAmountCkb(qAmount);
    if (qLabel) setLabel(qLabel);
    if (qPreimage) setPreimage(qPreimage);
    if (qClaimTo) setClaimTo(qClaimTo);
    if (qAddress && view === "claim") setLockAddress(qAddress);
  }, [searchParams]);

  useEffect(() => {
    if (preimage) {
      const buffer = hexFrom(
        Array.from(preimage).map((c) => c.charCodeAt(0)),
      );
      setHash(hashCkb(buffer).slice(2));
    }
  }, [preimage]);

  const refreshBalance = useCallback(async (addr: string) => {
    if (!addr) return;
    try {
      const cap = await capacityOf(addr);
      setBalance(shannonToCKB(cap).toString());
    } catch {
      setBalance("0");
    }
  }, []);

  useEffect(() => {
    if (!hash || !scriptDeployed()) return;
    try {
      const { address } = generateAccount(hash);
      setLockAddress(address);
      void refreshBalance(address);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to derive lock address");
    }
  }, [hash, refreshBalance]);

  useEffect(() => {
    if (!lockAddress) return;
    const id = setInterval(() => void refreshBalance(lockAddress), 12_000);
    return () => clearInterval(id);
  }, [lockAddress, refreshBalance]);

  useEffect(() => {
    if (lockAddress && amountCkb && label) {
      setPayerLink(
        buildPayerUrl({
          address: lockAddress,
          amount: amountCkb,
          label,
        }),
      );
    }
  }, [lockAddress, amountCkb, label]);

  const onClaim = async () => {
    setError(undefined);
    setClaiming(true);
    try {
      const h = await claimPayment(
        lockAddress,
        claimTo,
        amountCkb,
        preimage,
      );
      setTxHash(h);
      await wait(8);
      await refreshBalance(lockAddress);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  // Hash-lock via ckb_js_vm has large args — occupied capacity is ~108 CKB on this deploy.
  const canClaim =
    scriptDeployed() &&
    +amountCkb >= 110 &&
    +balance >= +amountCkb &&
    lockAddress.length > 0 &&
    claimTo.length > 0 &&
    !claiming;

  if (!scriptDeployed()) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-6 text-amber-100">
        <p className="font-semibold">hash-lock not configured for {currentNetwork}</p>
        <p className="mt-2 text-sm text-amber-200/90">
          From repo root:{" "}
          <code className="text-white">pnpm run sync:deployment</code> then{" "}
          <code className="text-white">pnpm run preflight</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300/90">
          CKB Pay Link · devnet
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Hash-lock payment requests</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          <strong className="text-white">CKB L1:</strong> create a lock address, share a
          payer link, fund on-chain, claim with your secret.{" "}
          <strong className="text-violet-200">Fiber L2:</strong> probe channels (Phase A).
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Network: <strong className="text-white">{currentNetwork}</strong>
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["create", "1. Create"],
            ["payer", "2. Pay (L1)"],
            ["claim", "3. Claim"],
            ["fiber", "4. Fiber"],
          ] as const
        ).map(([id, title]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === id
                ? id === "fiber"
                  ? "bg-violet-500 text-slate-950"
                  : "bg-emerald-500 text-slate-950"
                : "border border-white/10 bg-slate-900/50 text-slate-300 hover:text-white"
            }`}
          >
            {title}
          </button>
        ))}
      </nav>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {tab === "create" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white">New payment request</h2>
            {fromPulse && (
              <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                Prefilled from Pulse L1 handoff — amount, label, and preimage are set.
                Keep the preimage secret; share only the payer link after the lock address appears.
              </p>
            )}
            <label className="mt-4 block text-sm text-slate-300">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <label className="mt-4 block text-sm text-slate-300">Amount (CKB)</label>
            <input
              type="number"
              value={amountCkb}
              onChange={(e) => setAmountCkb(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <label className="mt-4 block text-sm text-slate-300">
              Secret preimage (keep for claim)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                value={preimage}
                onChange={(e) => setPreimage(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => setPreimage(generatePreimage())}
                className="shrink-0 rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200"
              >
                Generate
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Hash: <span className="font-mono text-slate-300">{hash || "—"}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white">Share with payer</h2>
            <p className="mt-2 text-sm text-slate-400">
              Send the link below — it does not include your secret.
            </p>
            <p className="mt-4 text-xs text-slate-500">Lock address</p>
            <p className="break-all rounded-lg bg-black/30 p-2 font-mono text-xs text-emerald-100">
              {lockAddress || "—"}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Funded: <strong className="text-white">{balance} CKB</strong>
            </p>
            <label className="mt-4 block text-xs text-slate-500">Payer link</label>
            <input
              readOnly
              value={payerLink}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-slate-200"
            />
            <button
              type="button"
              className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-slate-950"
              onClick={() => {
                void navigator.clipboard.writeText(payerLink);
              }}
              disabled={!payerLink}
            >
              Copy payer link
            </button>
          </div>
        </section>
      )}

      {tab === "payer" && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Pay this request</h2>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{payerLabel}</p>
          <p className="mt-2 text-sm text-slate-400">
            Send at least <strong className="text-white">{payerAmount} CKB</strong> to
            the lock (fund ~claim + 110 CKB spare if you will claim a partial amount —
            change cells for this hash-lock need ≥110 CKB):
          </p>
          <p className="mt-4 break-all rounded-lg bg-black/30 p-3 font-mono text-xs text-white">
            {payerAddress || "Open a payer link from Create tab"}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            On-chain balance: <strong className="text-white">{balance} CKB</strong>
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200"
            onClick={() => void refreshBalance(payerAddress)}
          >
            Refresh balance
          </button>
        </section>
      )}

      {tab === "fiber" && <FiberPanel />}

      {tab === "claim" && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-white">Claim payment</h2>
          <p className="mt-1 text-sm text-slate-400">
            Use the same preimage and amount as when you created the request.
          </p>
          {fromPulse && (
            <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Opened from Pulse L1 handoff — preimage and amount are prefilled. Confirm
              lock balance, set receiver, then claim.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Lock: <span className="font-mono text-slate-300">{lockAddress || "—"}</span>
          </p>
          <p className="text-xs text-slate-500">
            Balance: <strong className="text-white">{balance} CKB</strong>
          </p>
          <label className="mt-4 block text-sm text-slate-300">Receiver address</label>
          <input
            value={claimTo}
            onChange={(e) => setClaimTo(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white"
          />
          <button
            type="button"
            disabled={!canClaim}
            onClick={() => void onClaim()}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-bold text-slate-950 disabled:opacity-40"
          >
            {claiming ? "Claiming…" : "Claim to receiver"}
          </button>
          {txHash && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
              <p className="text-xs text-emerald-200">Transaction</p>
              <p className="mt-1 break-all font-mono text-xs text-white">{txHash}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
          <PayLinkApp />
        </Suspense>
      </div>
    </main>
  );
}
