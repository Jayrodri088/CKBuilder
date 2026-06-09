/**
 * Class 1 validation model — which scripts CKB-VM executes for a tx view.
 * @see https://docs.nervos.org/docs/script-course/intro-to-script-1
 */

export function scriptKey(script) {
  if (!script) return null;
  return `${script.codeHash}|${script.hashType}|${script.args ?? ""}`;
}

export function planValidation(txView) {
  const lockRuns = new Map();
  const typeRuns = new Map();

  for (const input of txView.inputs ?? []) {
    const k = scriptKey(input.lock);
    if (k && !lockRuns.has(k)) {
      lockRuns.set(k, { role: "lock", where: "input", script: input.lock });
    }
    if (input.type) {
      const tk = scriptKey(input.type);
      if (tk && !typeRuns.has(tk)) {
        typeRuns.set(tk, { role: "type", where: "input", script: input.type });
      }
    }
  }

  for (const output of txView.outputs ?? []) {
    if (output.type) {
      const tk = scriptKey(output.type);
      if (tk && !typeRuns.has(tk)) {
        typeRuns.set(tk, { role: "type", where: "output", script: output.type });
      }
    }
  }

  return {
    lockScriptsToRun: [...lockRuns.values()],
    typeScriptsToRun: [...typeRuns.values()],
    outputLocksNotExecuted: (txView.outputs ?? []).map((o) => o.lock).filter(Boolean),
  };
}

export function formatPlan(plan) {
  const lines = [];
  lines.push("Lock scripts to execute (deduped, inputs only):");
  for (const s of plan.lockScriptsToRun) {
    lines.push(`  - [${s.where}] ${s.script.codeHash?.slice(0, 18)}…`);
  }
  lines.push("Type scripts to execute (deduped, inputs + outputs):");
  for (const s of plan.typeScriptsToRun) {
    lines.push(`  - [${s.where}] ${s.script.codeHash?.slice(0, 18)}…`);
  }
  lines.push("Output lock scripts (NOT executed on creation):");
  for (const lock of plan.outputLocksNotExecuted) {
    lines.push(`  - skip ${lock.codeHash?.slice(0, 18)}…`);
  }
  return lines.join("\n");
}
