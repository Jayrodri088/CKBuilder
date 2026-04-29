"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  capacityOf,
  generateAccount,
  shannonToCKB,
  unlock,
  wait,
} from "./hash-lock";
import Link from "next/link";
import { Script, hashCkb, hexFrom } from "@ckb-ccc/core";
import scripts from "../deployment/scripts.json";
import { currentNetwork } from "./ccc-client";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <HashLock />
      </div>
    </main>
  );
}

function HashLock() {
  const scriptName = "hash-lock.bc";
  const myScripts = scripts[currentNetwork] as Record<string, unknown>;

  const [preimage, setPreimage] = useState<string>("Hello World");
  const [hash, setHash] = useState<string>("");
  const [fromAddr, setFromAddr] = useState("");
  const [fromLock, setFromLock] = useState<Script>();
  const [balance, setBalance] = useState("0");
  const [error, setError] = useState<string>();

  const [toAddr, setToAddr] = useState(
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew",
  );
  const [amountInCKB, setAmountInCKB] = useState("99");

  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState<string>();

  useEffect(() => {
    if (preimage != null) {
      const buffer = hexFrom(
        Array.from(preimage).map((c) => c.charCodeAt(0)),
      );
      const h = hashCkb(buffer).slice(2);
      setHash(h);
    }
  }, [preimage]);

  const updateFromInfo = useCallback(async () => {
    setError(undefined);
    const meta = myScripts;
    if (!meta[scriptName]) {
      setError(
        "hash-lock script metadata missing for this network. Deploy and sync scripts.json (see README).",
      );
      return;
    }
    try {
      const { lockScript, address } = generateAccount(hash);
      const capacity = await capacityOf(address);
      setFromAddr(address);
      setFromLock(lockScript);
      setBalance(shannonToCKB(capacity).toString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load account info.");
    }
  }, [hash, myScripts, scriptName]);

  useEffect(() => {
    if (hash && myScripts[scriptName] != null) {
      void updateFromInfo();
    }
  }, [hash, myScripts, scriptName, updateFromInfo]);

  const onTransfer = async () => {
    setError(undefined);
    setIsTransferring(true);
    try {
      const h = await unlock(fromAddr, toAddr, amountInCKB, preimage).catch(
        (e: unknown) => {
          setError(
            e instanceof Error ? e.message : "Transfer failed.",
          );
          return undefined as string | undefined;
        },
      );
      if (h) {
        setTxHash(h);
        await wait(10);
        await updateFromInfo();
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const enabled =
    +amountInCKB > 61 &&
    +balance > +amountInCKB &&
    toAddr.length > 0 &&
    !isTransferring &&
    !!myScripts[scriptName];

  const amountTip =
    amountInCKB.length > 0 && +amountInCKB < 61 ? (
      <span className="text-amber-200/90">
        Amount must be larger than 61 CKB, see{" "}
        <a
          className="underline decoration-sky-400/80 hover:text-white"
          href="https://docs.nervos.org/docs/wallets/#requirements-for-ckb-transfers"
          target="_blank"
          rel="noreferrer"
        >
          why
        </a>
      </span>
    ) : null;

  const scriptMeta = myScripts[scriptName] as
    | { codeHash?: string }
    | undefined;

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300/90">
          Nervos CKB · ckb-js-vm
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Simple Lock (hash-lock)
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Toy lock for learning only (devnet/testnet). Build a lock from a
          blake2b-256 hash, deposit CKB to the derived address, then transfer
          out by proving the preimage in the witness.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100">
          <span className="opacity-80">Network</span>
          <strong className="text-white">{currentNetwork}</strong>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Tutorial:{" "}
          <Link
            className="text-sky-400 underline-offset-2 hover:underline"
            href="https://docs.nervos.org/docs/dapp/simple-lock"
            target="_blank"
            rel="noreferrer"
          >
            Build a Simple Lock
          </Link>
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-lg backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white">Deployed script</h2>
        <p className="mt-1 text-sm text-slate-400">
          <code className="text-sky-200/90">{scriptName}</code> — must match{" "}
          <code className="text-sky-200/90">frontend/deployment/scripts.json</code>{" "}
          for this network.
        </p>
        <div className="mt-4 break-all rounded-xl border border-white/5 bg-black/30 p-4 font-mono text-xs text-slate-200">
          {scriptMeta?.codeHash ?? (
            <span className="text-amber-200">
              Not found for this network — run{" "}
              <code className="text-white">pnpm run deploy -- --network devnet</code>{" "}
              from the repo root, then copy{" "}
              <code className="text-white">deployment/scripts.json</code> into{" "}
              <code className="text-white">frontend/deployment/</code>.
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-lg backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white">Build the lock</h2>
          <p className="mt-1 text-sm text-slate-400">
            Preimage is hashed client-side; the hash becomes part of the lock
            args (toy demo — not production-safe).
          </p>

          <label
            className="mt-4 block text-sm font-medium text-slate-300"
            htmlFor="preimage"
          >
            Preimage
          </label>
          <input
            id="preimage"
            type="text"
            value={preimage}
            onChange={(e) => setPreimage(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
          />

          <label
            className="mt-4 block text-sm font-medium text-slate-300"
            htmlFor="hash"
          >
            Hash (blake2b-256, hex)
          </label>
          <input
            id="hash"
            type="text"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-xs text-slate-200 outline-none ring-sky-500/40 focus:ring-2"
          />

          <p className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-slate-300">
            External hash tool:{" "}
            <Link
              className="text-sky-400 underline-offset-2 hover:underline"
              href="https://codesandbox.io/p/sandbox/calculate-blake2b-256-hash-6h2s8?file=%2Fsrc%2FApp.vue%3A55%2C25"
              target="_blank"
              rel="noreferrer"
            >
              blake2b-256 sandbox
            </Link>
          </p>

          <div className="mt-6 space-y-2 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">CKB address</span>
            </p>
            <p className="break-all rounded-lg bg-black/30 p-2 font-mono text-xs">
              {fromAddr || "—"}
            </p>
            <p className="pt-2">
              <span className="text-slate-500">Lock script</span>
            </p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] text-slate-300">
              {fromLock ? JSON.stringify(fromLock, null, 2) : "—"}
            </pre>
            <p className="pt-2">
              <span className="text-slate-500">Total capacity</span>{" "}
              <strong className="text-white">{balance} CKB</strong>
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-lg backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white">
            Transfer from hash lock
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Uses the same preimage as witness proof (matches the hash above).
          </p>

          <label
            className="mt-4 block text-sm font-medium text-slate-300"
            htmlFor="to-address"
          >
            Receiver address
          </label>
          <input
            id="to-address"
            type="text"
            value={toAddr}
            onChange={(e) => setToAddr(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-xs text-white outline-none ring-sky-500/40 focus:ring-2"
          />

          <label
            className="mt-4 block text-sm font-medium text-slate-300"
            htmlFor="amount"
          >
            Amount (CKB)
          </label>
          <input
            id="amount"
            type="number"
            value={amountInCKB}
            onChange={(e) => setAmountInCKB(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
          />
          <p className="mt-2 text-xs text-slate-500">Tx fee: ~0.001 CKB</p>
          {amountTip && <div className="mt-2 text-xs">{amountTip}</div>}

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!enabled}
            onClick={onTransfer}
          >
            {isTransferring ? "Transferring…" : "Transfer"}
          </button>

          {txHash && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
              <p className="text-xs font-medium text-emerald-200/90">tx hash</p>
              <p className="mt-1 break-all font-mono text-xs text-white">
                {txHash}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
