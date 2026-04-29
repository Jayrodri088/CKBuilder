import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  capacityOf,
  generateAccountFromPrivateKey,
  createSporeDOB,
  showSporeContent,
  shannonToCKB,
} from "./lib";
import { hexStringToUint8Array } from "./helper";
import { RawSporeData } from "@spore-sdk/core";
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<Uint8Array | null>(null);

  const [txHash, setTxHash] = useState<string>();
  const [outputIndex, setOutputIndex] = useState<number>();
  const [rawSporeData, setRawSporeData] = useState<RawSporeData>();
  const [imageURL, setImageURL] = useState<string>();
  const [error, setError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const updateFromInfo = async () => {
      const { lockScript, address } = await generateAccountFromPrivateKey(privKey);
      const capacity = await capacityOf(address);
      setFromAddr(address);
      setFromLock(lockScript);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);

      const reader = new FileReader();
      reader.onload = () => {
        // Access the file content here
        const content = reader.result;
        if (content && content instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(content);
          setFileContent(uint8Array);
        }
      };

      // Read the file as ArrayBuffer
      reader.readAsArrayBuffer(files[0]);
    }
  };

  const createSpore = async () => {
    if (!fileContent) return;
    setError(undefined);
    setRawSporeData(undefined);
    setImageURL(undefined);
    setIsCreating(true);
    try {
      const { txHash, outputIndex } = await createSporeDOB(privKey, fileContent);
      setTxHash(txHash);
      setOutputIndex(outputIndex);
    } catch (e: any) {
      setError(e?.message || "Failed to create DOB.");
    } finally {
      setIsCreating(false);
    }
  };

  const renderSpore = async () => {
    if (!txHash || outputIndex == null) return;
    setError(undefined);
    setIsChecking(true);
    try {
      const res = await showSporeContent(txHash, outputIndex);
      setRawSporeData(res);

      const buffer = hexStringToUint8Array(res.content.toString().slice(2));
      const blob = new Blob([buffer], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      setImageURL(url);
    } catch (e: any) {
      setError(e?.message || "Failed to read spore content.");
    } finally {
      setIsChecking(false);
    }
  };

  const enabled = +balance > 0 && !!fileContent;
  const enabledRead = !!txHash && outputIndex != null;

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">Nervos CKB Spore Protocol</p>
        <h1>Create On-chain Digital Objects</h1>
        <p className="subtitle">
          Upload an image, create a DOB as a Spore cell, then read and render it back from chain.
        </p>
        <p className="network-badge">
          Active network: <strong>{currentNetwork}</strong>
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Sender Account</h2>
          <label htmlFor="private-key">Private Key</label>
          <input
            id="private-key"
            type="text"
            value={privKey}
            onChange={onInputPrivKey}
          />

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
          <h2>DOB Creation</h2>
          <label htmlFor="dob-file">Upload DOB Image File</label>
          <input id="dob-file" type="file" onChange={handleFileChange} />
          {selectedFile && <p className="muted">File size: {selectedFile.size} bytes</p>}
          <p className="muted">Estimated tx fee: 0.001 CKB</p>
          {error && <p className="error">{error}</p>}

          <div className="action-row">
            <button disabled={!enabled || isCreating} onClick={createSpore}>
              {isCreating ? "Creating..." : "Create DOB"}
            </button>
            <button className="secondary" disabled={!enabledRead || isChecking} onClick={renderSpore}>
              {isChecking ? "Checking..." : "Check Spore Content"}
            </button>
          </div>

          {txHash && (
            <div className="success">
              <p><strong>DOB Created</strong></p>
              <p className="muted">tx hash</p>
              <code>{txHash}</code>
              <p className="muted">output index: {outputIndex}</p>
            </div>
          )}

          {rawSporeData && (
            <div className="success">
              <p><strong>Spore Content</strong></p>
              <p className="muted">content-type: {rawSporeData.contentType}</p>
            </div>
          )}

          {imageURL && <img className="preview" src={imageURL} alt="Rendered DOB preview" />}
        </article>
      </section>
    </main>
  );
}
