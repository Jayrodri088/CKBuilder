import { createRoot } from "react-dom/client";
import React, { useEffect, useState } from 'react';
import { capacityOf, generateAccountFromPrivateKey, shannonToCKB, transfer, wait } from './lib';
import { Script } from '@ckb-ccc/core';
import { currentNetwork } from './ccc-client';
import './styles.css';

const container = document.getElementById("root");
const root = createRoot(container)
root.render(<App />);

export function App() {
  // default value: first account privkey from offckb
  const [privKey, setPrivKey] = useState('0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6');
  const [fromAddr, setFromAddr] = useState('');
  const [fromLock, setFromLock] = useState<Script>();
  const [balance, setBalance] = useState('0');

  // default value: second account address from offckb
  const [toAddr, setToAddr] = useState('ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew');
  // default value: 62 CKB
  const [amountInCKB, setAmountInCKB] = useState('62');

  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (privKey) {
      updateFromInfo();
    }
  }, [privKey]);

  const updateFromInfo = async () => {
    const { lockScript, address } = await generateAccountFromPrivateKey(privKey);
    const capacity = await capacityOf(address);
    setFromAddr(address);
    setFromLock(lockScript);
    setBalance(shannonToCKB(capacity).toString());
  };

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

  const onTransfer = async () => {
    setIsTransferring(true);
    setError(undefined);
    const txHash = await transfer(toAddr, amountInCKB, privKey).catch(alert);

    // We can wait for this txHash to be on-chain so that we can trigger the UI/UX updates including balance.
    if(txHash){
      setTxHash(txHash);
      // wait 10 seconds for tx confirm
      // the right way to do this is to use get_transaction rpc but here we just keep it simple
      await wait(10);
      
      await updateFromInfo();
    }
    
   setIsTransferring(false);
  }

  const enabled = +amountInCKB > 61 && +balance > +amountInCKB && toAddr.length > 0 && !isTransferring;
  const amountTip =
    amountInCKB.length > 0 && +amountInCKB < 61 ? (
      <span className="tip">
        amount must larger than 61 CKB, see{' '}
        <a href="https://docs.nervos.org/docs/wallets/#requirements-for-ckb-transfers" target="_blank" rel="noreferrer">
          why
        </a>
      </span>
    ) : null;

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">Nervos CKB Simple Transfer</p>
        <h1>Simple CKB Transfer dApp</h1>
        <p className="subtitle">
          Send CKB with a clean UI, readable account info, and transaction feedback.
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
            <input id="private-key" type="text" value={privKey} onChange={onInputPrivKey} />
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
          <h2>Transfer</h2>
          <label htmlFor="to-address">Recipient Address</label>
          <input id="to-address" type="text" value={toAddr} onChange={(e) => setToAddr(e.target.value)} />

          <label htmlFor="amount">Amount (CKB)</label>
          <input id="amount" type="number" value={amountInCKB} onChange={(e) => setAmountInCKB(e.target.value)} />

          <p className="muted">Estimated tx fee: 0.001 CKB</p>
          {amountTip}
          {error && <p className="error">{error}</p>}

          <button disabled={!enabled} onClick={onTransfer}>
            {isTransferring ? "Transferring..." : "Transfer"}
          </button>

          {txHash && (
            <div className="success">
              <p><strong>Transaction sent</strong></p>
              <code>{txHash}</code>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
