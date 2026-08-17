import { NextRequest, NextResponse } from "next/server";
import { fetchPublicFiberSnapshot } from "@/lib/server/fiber-rpc";
import {
  paymentPolicy,
  paymentTargetConfigured,
  expectedInvoiceCurrency,
  parseFiberInvoice,
  runFiberPayment,
  validExecutionToken,
} from "@/lib/server/fiber-payment";
import { consumePaymentGrant, assertPaymentGrant, looksLikePaymentGrant } from "@/lib/server/payment-grant";
import { claimCooldown } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const policy = paymentPolicy();
  return NextResponse.json({ ...policy, targetConfigured: paymentTargetConfigured() }, {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const policy = paymentPolicy();
  if (!policy.enabled) return failure(403, "Fiber payment proof is disabled.");

  let body: { amountCkb?: unknown; requestId?: unknown; execute?: unknown; invoice?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure(400, "Invalid JSON body.");
  }

  const amountCkb = Number(body.amountCkb);
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const execute = body.execute === true;
  const invoice = typeof body.invoice === "string" ? body.invoice.trim() : undefined;
  if (!invoice && !paymentTargetConfigured()) {
    return failure(503, "A merchant invoice or trusted Fiber payment target is required.");
  }
  if (invoice && !policy.invoicePaymentsEnabled) {
    return failure(403, "Merchant invoice payments are disabled on this deployment.");
  }
  if (!Number.isFinite(amountCkb) || amountCkb <= 0 || amountCkb > policy.maxCkb) {
    return failure(400, `Amount must be between 0 and ${policy.maxCkb} CKB.`);
  }
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(requestId)) {
    return failure(400, "A valid payment request ID is required.");
  }
  if (execute && !policy.executionEnabled) {
    return failure(403, "Live Fiber execution is disabled on this deployment.");
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (execute) {
    if (looksLikePaymentGrant(bearer)) {
      const preview = assertPaymentGrant({
        token: bearer!,
        requestId,
        amountCkb,
        invoice,
      });
      if (!preview.ok) return failure(403, preview.error);
    } else if (!validExecutionToken(bearer)) {
      return failure(403, "A valid operator token or unused payment grant is required for live execution.");
    }
  }

  const slot = claimCooldown("payment", policy.cooldownMs);
  if (!slot.ok) {
    return NextResponse.json(
      { error: "Payment proof cooldown is active.", retryAfterMs: slot.retryAfterMs },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  const snapshot = await fetchPublicFiberSnapshot();
  if (!snapshot.reachable || !snapshot.node) {
    return failure(409, "Fiber node is unavailable for payment validation.");
  }
  try {
    if (invoice) {
      const parsed = await parseFiberInvoice(invoice);
      const expectedCurrency = expectedInvoiceCurrency(snapshot.node.network);
      if (!expectedCurrency || parsed.currency !== expectedCurrency) {
        return failure(400, `Invoice currency does not match ${snapshot.node.network}.`);
      }
      if (Math.round(parsed.amountCkb * 100_000_000) !== Math.round(amountCkb * 100_000_000)) {
        return failure(400, "Invoice amount does not match the payment request.");
      }
      if (parsed.expired) return failure(400, "Merchant invoice has expired.");
    }
  } catch {
    return failure(400, "Fiber invoice could not be parsed or verified.");
  }
  if (!snapshot.node.synced || snapshot.peerCount === 0) {
    return failure(409, "Fiber node is not ready for a payment attempt.");
  }
  if (execute && snapshot.node.network.toLowerCase() !== policy.allowedNetwork) {
    return failure(403, `Live execution is restricted to ${policy.allowedNetwork}.`);
  }
  if (snapshot.maxSendableCkb < amountCkb) {
    return failure(409, "Ready channels do not have enough outbound CKB liquidity.");
  }
  if (execute && looksLikePaymentGrant(bearer)) {
    const consumed = consumePaymentGrant({
      token: bearer!,
      requestId,
      amountCkb,
      invoice,
    });
    if (!consumed.ok) return failure(403, consumed.error);
  }

  try {
    const receipt = await runFiberPayment({ amountCkb, requestId, execute, invoice });
    return NextResponse.json(receipt, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error("Fiber payment command failed");
    return failure(502, "Fiber payment proof failed. Check node, peer, channel, and CLI readiness.");
  }
}

function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
