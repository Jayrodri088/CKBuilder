import { NextRequest, NextResponse } from "next/server";
import { fetchPublicFiberSnapshot } from "@/lib/server/fiber-rpc";
import { expectedInvoiceCurrency, parseFiberInvoice } from "@/lib/server/fiber-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let lastValidationAt = 0;

export async function POST(request: NextRequest) {
  let body: { invoice?: unknown; amountCkb?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure(400, "Invalid JSON body.");
  }
  const invoice = typeof body.invoice === "string" ? body.invoice.trim() : "";
  const requestedAmount = body.amountCkb === undefined ? undefined : Number(body.amountCkb);
  if (!invoice) return failure(400, "Fiber invoice is required.");
  const now = Date.now();
  const cooldownMs = Number(process.env.FIBER_INVOICE_VALIDATION_COOLDOWN_MS ?? 750);
  if (now - lastValidationAt < cooldownMs) {
    return NextResponse.json(
      { valid: false, error: "Invoice validation cooldown is active.", retryAfterMs: cooldownMs - (now - lastValidationAt) },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }
  lastValidationAt = now;
  if (requestedAmount !== undefined && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
    return failure(400, "Payment request amount is invalid.");
  }

  const snapshot = await fetchPublicFiberSnapshot();
  if (!snapshot.reachable || !snapshot.node) return failure(409, "Fiber node is unavailable.");
  try {
    const summary = await parseFiberInvoice(invoice);
    const expectedCurrency = expectedInvoiceCurrency(snapshot.node.network);
    if (!expectedCurrency || summary.currency !== expectedCurrency) {
      return failure(400, `Invoice currency does not match ${snapshot.node.network}.`);
    }
    if (
      requestedAmount !== undefined &&
      Math.round(summary.amountCkb * 100_000_000) !== Math.round(requestedAmount * 100_000_000)
    ) {
      return failure(400, "Invoice amount does not match the payment request.");
    }
    if (summary.expired) return failure(400, "Fiber invoice has expired.");
    return NextResponse.json({ valid: true, network: snapshot.node.network, invoice: summary }, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return failure(400, "Fiber invoice could not be parsed or verified.");
  }
}

function failure(status: number, error: string) {
  return NextResponse.json({ valid: false, error }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
