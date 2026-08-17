import { NextRequest, NextResponse } from "next/server";
import { fetchPublicFiberSnapshot } from "@/lib/server/fiber-rpc";
import {
  cancelFiberInvoice,
  expectedInvoiceCurrency,
  parseFiberInvoice,
  validExecutionToken,
  watchFiberInvoice,
} from "@/lib/server/fiber-payment";
import { claimCooldown } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { invoice?: unknown; amountCkb?: unknown; watch?: unknown; cancel?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure(400, "Invalid JSON body.");
  }
  const invoice = typeof body.invoice === "string" ? body.invoice.trim() : "";
  const requestedAmount = body.amountCkb === undefined ? undefined : Number(body.amountCkb);
  const watch = body.watch === true;
  const cancel = body.cancel === true;
  if (!invoice) return failure(400, "Fiber invoice is required.");
  if (cancel) {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    if (!validExecutionToken(bearer)) {
      return failure(403, "A valid operator token is required to cancel an invoice.");
    }
  }
  const cooldownKey = cancel ? "invoice-cancel" : watch ? "invoice-watch" : "invoice-validate";
  const cooldownMs = Number(
    process.env[
      cancel
        ? "FIBER_INVOICE_CANCEL_COOLDOWN_MS"
        : watch
          ? "FIBER_INVOICE_WATCH_COOLDOWN_MS"
          : "FIBER_INVOICE_VALIDATION_COOLDOWN_MS"
    ] ?? (cancel ? 1000 : watch ? 2000 : 750),
  );
  const slot = claimCooldown(cooldownKey, cooldownMs);
  if (!slot.ok) {
    return NextResponse.json(
      { valid: false, error: "Invoice cooldown is active.", retryAfterMs: slot.retryAfterMs },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }
  if (requestedAmount !== undefined && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
    return failure(400, "Payment request amount is invalid.");
  }

  const snapshot = await fetchPublicFiberSnapshot();
  if (!snapshot.reachable || !snapshot.node) return failure(409, "Fiber node is unavailable.");
  try {
    if (watch || cancel) {
      const watched = cancel ? await cancelFiberInvoice(invoice) : await watchFiberInvoice(invoice);
      const expectedCurrency = expectedInvoiceCurrency(snapshot.node.network);
      if (!expectedCurrency || watched.invoice.currency !== expectedCurrency) {
        return failure(400, `Invoice currency does not match ${snapshot.node.network}.`);
      }
      if (
        requestedAmount !== undefined &&
        Math.round(watched.invoice.amountCkb * 100_000_000) !== Math.round(requestedAmount * 100_000_000)
      ) {
        return failure(400, "Invoice amount does not match the payment request.");
      }
      return NextResponse.json(
        {
          valid: true,
          watch: true,
          cancelled: cancel,
          network: snapshot.node.network,
          status: watched.status,
          settled: watched.settled,
          invoice: watched.invoice,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

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
