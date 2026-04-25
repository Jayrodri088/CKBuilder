import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildMessageTx,
  capacityOf,
  generateAccountFromPrivateKey,
  readOnChainMessage,
  shannonToCKB,
} from "./lib";
import { Script } from "@ckb-ccc/core";
import { currentNetwork } from "./ccc-client";
import "./styles.css";

const container = document.getElementById("root");
const root = createRoot(container)
root.render(<App />);

export function App() {
  // default value: first account privkey from offckb
  const [privKey, setPrivKey] = useState(
    "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6"
  );
  const [fromAddr, setFromAddr] = useState("");
  const [fromLock, setFromLock] = useState<Script>();
  const [balance, setBalance] = useState("0");

  const [message, setMessage] = useState("hello common knowledge base!");
  const [txHash, setTxHash] = useState<string>();
  const [readMessage, setReadMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isWriting, setIsWriting] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const updateFromInfo = async () => {
    const { lockScript, address } = await generateAccountFromPrivateKey(privKey);
    const capacity = await capacityOf(address);
    setFromAddr(address);
    setFromLock(lockScript);
    setBalance(shannonToCKB(capacity).toString());
  };

  useEffect(() => {
    if (privKey) {
      updateFromInfo();
    }
  }, [privKey]);

  const onInputPrivKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const priv = e.target.value;
    setPrivKey(priv);
    setError(undefined);
  };

  const updateAccountByPrivkey = async () => {
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/;
    if (!privateKeyRegex.test(privKey)) {
      setError("Private key must start with 0x and contain exactly 64 hex characters.");
      return;
    }
    await updateFromInfo();
  };

  const enabled = +balance > 0 && message.length > 0;
  const enabledRead = !!txHash;

  const onWrite = async () => {
    setError(undefined);
    setReadMessage(undefined);
    setIsWriting(true);
    try {
      const hash = await buildMessageTx(message, privKey);
      setTxHash(hash);
    } catch (e: any) {
      setError(e?.message || "Write transaction failed. Check network and private key.");
    } finally {
      setIsWriting(false);
    }
  };

  const onRead = async () => {
    if (!txHash) return;
    setError(undefined);
    setReadMessage(undefined);
    setIsReading(true);
    try {
      const msg = await readOnChainMessage(txHash);
      setReadMessage(msg);
    } catch (e: any) {
      setError(e?.message || "Failed to read message from chain.");
    } finally {
      setIsReading(false);
    }
  };

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">Nervos CKB Store Data</p>
        <h1>Store Data on Cell</h1>
        <p className="subtitle">
          Write a message into a CKB Cell, then read it back from chain using the output cell.
        </p>
        <p className="network-badge">
          Active network: <strong>{currentNetwork}</strong>
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Sender Account</h2>
          <label htmlFor="private-key">Private Key</label>
          <div className="inline">
            <input
              id="private-key"
              type="text"
              value={privKey}
              onChange={onInputPrivKey}
            />
            <button className="secondary" onClick={updateAccountByPrivkey}>
              Refresh
            </button>
          </div>

          <div className="stat">
            <span>Total Capacity</span>
            <strong>{balance} CKB</strong>
          </div>

          <div className="details">
            <p><strong>Address</strong></p>
            <code>{fromAddr || "Waiting for valid private key..."}</code>
          </div>

          <div className="details">
            <p><strong>Current Lock Script</strong></p>
            <pre>{JSON.stringify(fromLock, null, 2)}</pre>
          </div>
        </article>

        <article className="card">
          <h2>Message Cell</h2>
          <label htmlFor="message">Message to store on chain</label>
          <input
            id="message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <p className="muted">Estimated tx fee: 0.001 CKB</p>
          {error && <p className="error">{error}</p>}

          <div className="action-row">
            <button disabled={!enabled || isWriting} onClick={onWrite}>
              {isWriting ? "Writing..." : "Write"}
            </button>
            <button
              className="secondary"
              disabled={!enabledRead || isReading}
              onClick={onRead}
            >
              {isReading ? "Reading..." : "Read"}
            </button>
          </div>

          {txHash && (
            <div className="success">
              <p><strong>Message written</strong></p>
              <code>{txHash}</code>
            </div>
          )}
          {readMessage && (
            <div className="success">
              <p><strong>Decoded message</strong></p>
              <code>{readMessage}</code>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
