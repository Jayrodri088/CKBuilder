import type { PaymentRequest } from "./types";
import { updateRequest } from "./store";
import { applyOutboundSpend, loadMockNode } from "./mock-node";

/** Simulate a Fiber invoice settle — target feel ~60ms. */
export async function mockSettleInvoice(
  id: string,
  amountCkb: number,
): Promise<{ ok: boolean; ms: number; error?: string }> {
  const wait = 28 + Math.floor(Math.random() * 45);
  await new Promise((r) => setTimeout(r, wait));
  applyOutboundSpend(loadMockNode(), amountCkb);
  const updated = updateRequest(id, {
    status: "paid",
    paidAt: Date.now(),
  });
  if (!updated) {
    // Share-link pays may not be in local store; still succeed for demo.
    return { ok: true, ms: wait };
  }
  return { ok: true, ms: wait };
}

/** Stream settle: ticks until the session cap. */
export async function mockStreamTick(
  req: PaymentRequest,
): Promise<{ ok: boolean; streamed: number; done: boolean; ms: number }> {
  const tick = req.tickCkb ?? 0.01;
  const cap = req.streamCapCkb ?? req.amountCkb;
  const current = req.streamedCkb ?? 0;
  const next = Math.min(cap, +(current + tick).toFixed(6));
  const wait = 12 + Math.floor(Math.random() * 30);
  await new Promise((r) => setTimeout(r, wait));
  applyOutboundSpend(loadMockNode(), Math.min(tick, cap - current));
  const done = next >= cap;
  const patched = updateRequest(req.id, {
    streamedCkb: next,
    status: done ? "capped" : "streaming",
    paidAt: done ? Date.now() : req.paidAt,
  });
  if (!patched) {
    req.streamedCkb = next;
    req.status = done ? "capped" : "streaming";
  }
  return { ok: true, streamed: next, done, ms: wait };
}
