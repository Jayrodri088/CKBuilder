import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  capacityOf,
  generateAccountFromPrivateKey,
  issueToken,
  queryIssuedTokenCells,
  shannonToCKB,
  transferTokenToAddress,
} from "./lib";
import { ccc, CellOutput, Script } from "@ckb-ccc/core";
import { currentNetwork } from "./ccc-client";
import "./styles.css";

const container = document.getElementById("root");
const root = createRoot(container)
root.render(<App />);

function IssuedToken() {
  const [privKey, setPrivKey] = useState(
    "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6"
  );
  const [lockScript, setLockScript] = useState<Script>();
  const [balance, setBalance] = useState("0");
  const [amount, setAmount] = useState("42");

  const [issuedTokenCell, setIssuedTokenCell] = useState<CellOutput>();
  const [txHash, setTxHash] = useState<string>();
  const [error, setError] = useState<string>();
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    const updateFromInfo = async () => {
      const { lockScript, address } = await generateAccountFromPrivateKey(privKey);
      const capacity = await capacityOf(address);
      setLockScript(lockScript);
      setBalance(shannonToCKB(capacity).toString());
    };

    if (privKey) {
      updateFromInfo();
    }
  }, [privKey]);

  const onInputPrivKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const priv = e.target.value;
    setPrivKey(priv);
    setError(undefined);
  };

  const refreshSender = async () => {
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/;
    if (!privateKeyRegex.test(privKey)) {
      setError("Private key must start with 0x and contain exactly 64 hex characters.");
      return;
    }
    const { lockScript, address } = await generateAccountFromPrivateKey(privKey);
    const capacity = await capacityOf(address);
    setLockScript(lockScript);
    setBalance(shannonToCKB(capacity).toString());
  };

  const enabledIssue = +amount > 0 && +balance > 61;
  const tokenArgs = issuedTokenCell?.type?.args;

  const onIssue = async () => {
    setError(undefined);
    setIsIssuing(true);
    try {
      const result = await issueToken(privKey, amount);
      setIssuedTokenCell(result.targetOutput);
      setTxHash(result.hash);
    } catch (e: any) {
      setError(e?.message || "Issue token transaction failed.");
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <article className="card">
      <h2>Step 1: Issue Custom Token</h2>

      <label htmlFor="private-key">Issuer Private Key</label>
      <div className="inline">
        <input id="private-key" type="text" value={privKey} onChange={onInputPrivKey} />
        <button className="secondary" onClick={refreshSender}>
          Refresh
        </button>
      </div>

      <div className="stat">
        <span>Total Capacity</span>
        <strong>{balance} CKB</strong>
      </div>

      <div className="details">
        <p><strong>Lock Script Hash</strong></p>
        <code>{lockScript?.hash() || "Waiting for valid private key..."}</code>
      </div>
      <div className="details">
        <p><strong>Lock Script</strong></p>
        <pre>{JSON.stringify(lockScript, null, 2)}</pre>
      </div>

      <label htmlFor="amount">Token Amount</label>
      <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      {error && <p className="error">{error}</p>}

      <button disabled={!enabledIssue || isIssuing} onClick={onIssue}>
        {isIssuing ? "Issuing..." : "Issue Token"}
      </button>

      {txHash && issuedTokenCell && (
        <div className="success">
          <p><strong>Issued Token Result</strong></p>
          <p className="muted">xUDT args (token id)</p>
          <code>{tokenArgs}</code>
          <p className="muted">Transaction hash</p>
          <code>{txHash}</code>
          <p className="muted">
            Token cell capacity: {ccc.fixedPointToString(issuedTokenCell.capacity)} CKB
          </p>
        </div>
      )}
    </article>
  );
}

function ViewIssuedToken() {
  const [xudtArgs, setXudtArgs] = useState<string>("");
  const [cells, setCells] = useState<ccc.Cell[]>([]);
  const [error, setError] = useState<string>();
  const [isQuerying, setIsQuerying] = useState(false);

  const onQuery = async () => {
    setError(undefined);
    setIsQuerying(true);
    const cells = await queryIssuedTokenCells(xudtArgs as `0x{string}`).catch((e) => {
      setError(e?.message || "Failed to query token cells.");
      return undefined;
    });
    if (cells && cells.length > 0) {
      setCells(cells);
    } else if (!error) {
      setCells([]);
      setError("No cells found yet. Wait for new blocks and try again.");
    }
    setIsQuerying(false);
  };

  return (
    <article className="card">
      <h2>Step 2: View Custom Token</h2>
      <label htmlFor="xudt-args">xUDT args</label>
      <input id="xudt-args" type="text" value={xudtArgs} onChange={(e) => setXudtArgs(e.target.value)} />

      <button disabled={!xudtArgs || isQuerying} onClick={onQuery}>
        {isQuerying ? "Querying..." : "Query Issued Token"}
      </button>
      {error && <p className="error">{error}</p>}
      {cells.length > 0 && <p className="muted">All live cells that host this token:</p>}
      {cells.map((cell, index) => (
        <div key={index} className="result-card">
          <p><strong>Cell #{index}</strong></p>
          <p>Token amount: {ccc.numLeFromBytes(cell.outputData).toString()}</p>
          <p>xUDT args: {cell.cellOutput.type.args}</p>
          <p>Holder lock args: {cell.cellOutput.lock.args}</p>
        </div>
      ))}
    </article>
  );
}

function TransferIssuedToken() {
  const [udtArgs, setUdtArgs] = useState<string>("");
  const [senderPrivkey, setSenderPrivkey] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [tx, setTx] = useState<ccc.Transaction>();
  const [txHash, setTxHash] = useState<string>();
  const [error, setError] = useState<string>();
  const [isTransferring, setIsTransferring] = useState(false);

  const onInputSenderPrivKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSenderPrivkey(e.target.value);
    setError(undefined);
  };

  const enabledCheck =
    senderPrivkey.length > 0 && udtArgs.length > 0 && transferAmount.length > 0 && receiverAddress.length > 0;

  const onTransfer = async () => {
    setError(undefined);
    setIsTransferring(true);
    try {
      const res = await transferTokenToAddress(udtArgs, senderPrivkey, transferAmount, receiverAddress);
      setTx(res.tx);
      setTxHash(res.txHash);
    } catch (e: any) {
      setError(e?.message || "Transfer custom token failed.");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <article className="card">
      <h2>Step 3: Transfer Custom Token</h2>
      <label htmlFor="sender-private-key">Sender Private Key</label>
      <input id="sender-private-key" type="text" value={senderPrivkey} onChange={onInputSenderPrivKey} />

      <label htmlFor="udt">xUDT args</label>
      <input id="udt" type="text" value={udtArgs} onChange={(e) => setUdtArgs(e.target.value)} />

      <label htmlFor="transferAmount">Transfer Token Amount</label>
      <input id="transferAmount" type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />

      <label htmlFor="receiverAddress">Receiver Address</label>
      <input id="receiverAddress" type="text" value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} />

      {error && <p className="error">{error}</p>}
      <button
        disabled={!enabledCheck}
        onClick={onTransfer}
      >
        {isTransferring ? "Transferring..." : "Transfer Custom Token"}
      </button>
      {tx && (
        <div className="success">
          <p><strong>Transfer Result</strong></p>
          {txHash && (
            <>
              <p className="muted">Transaction hash</p>
              <code>{txHash}</code>
            </>
          )}
          <p className="muted">Transaction</p>
          <pre>{tx.stringify()}</pre>
        </div>
      )}
    </article>
  );
}

export function App() {
  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">Nervos CKB xUDT</p>
        <h1>Create and Transfer Fungible Tokens</h1>
        <p className="subtitle">
          Issue an xUDT token, query holders, and transfer balances with a cleaner workflow.
        </p>
        <p className="network-badge">
          Active network: <strong>{currentNetwork}</strong>
        </p>
        <p className="muted">
          xUDT spec:{" "}
          <a
            href="https://github.com/XuJiandong/rfcs/blob/xudt/rfcs/0052-extensible-udt/0052-extensible-udt.md#xudt-witness"
            target="_blank"
            rel="noreferrer"
          >
            RFC-0052
          </a>
        </p>
      </section>

      <section className="stack">
      <IssuedToken />
      <ViewIssuedToken />
      <TransferIssuedToken />
      </section>
    </main>
  );
}
