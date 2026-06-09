import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

export function ensureDebuggerOnPath() {
  if (process.env.CKB_DEBUGGER_BIN) {
    prependPath(path.dirname(process.env.CKB_DEBUGGER_BIN));
    return process.env.CKB_DEBUGGER_BIN;
  }

  const local = path.join(
    root,
    "..",
    "simple-lock",
    "tools",
    "ckb-debugger",
    "v1.1.1",
    process.platform === "win32" ? "ckb-debugger.exe" : "ckb-debugger",
  );
  if (fs.existsSync(local)) {
    const resolved = path.resolve(local);
    process.env.CKB_DEBUGGER_BIN = resolved;
    prependPath(path.dirname(resolved));
    return resolved;
  }
  return "ckb-debugger";
}

function prependPath(dir) {
  const sep = path.delimiter;
  if (!process.env.PATH?.split(sep).includes(dir)) {
    process.env.PATH = `${dir}${sep}${process.env.PATH ?? ""}`;
  }
}
