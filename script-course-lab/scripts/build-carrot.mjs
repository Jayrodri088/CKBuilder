#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDebuggerOnPath } from "../lib/debugger.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const contractName = "carrot";
const srcFile = path.join(root, "contracts", contractName, "src", "index.ts");
const distDir = path.join(root, "dist");
const outputJs = path.join(distDir, `${contractName}.js`);
const outputBc = path.join(distDir, `${contractName}.bc`);

function resolveDebuggerBin() {
  return ensureDebuggerOnPath();
}

fs.mkdirSync(distDir, { recursive: true });

const esbuildBin = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "esbuild.cmd" : "esbuild",
);
const vmBin = path.join(
  root,
  "node_modules",
  "ckb-testtool",
  "src",
  "unittest",
  "defaultScript",
  "ckb-js-vm",
);

console.log("Building carrot (Class 2 type script)…");
execSync(
  `"${path.resolve(esbuildBin)}" --platform=neutral --minify --bundle --external:@ckb-js-std/bindings --target=es2022 "${srcFile}" --outfile="${outputJs}"`,
  { stdio: "inherit", shell: process.platform === "win32", cwd: root },
);

const debuggerBin = resolveDebuggerBin();
execSync(
  `"${debuggerBin}" --read-file "${outputJs}" --bin "${vmBin}" -- -c "${outputBc}"`,
  { stdio: "inherit", shell: process.platform === "win32", cwd: root },
);

console.log("PASS: dist/carrot.bc ready for mock verification.");
