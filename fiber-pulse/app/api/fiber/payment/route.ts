import { NextRequest, NextResponse } from "next/server";
import { fetchPublicFiberSnapshot } from "@/lib/server/fiber-rpc";
import {
  paymentPolicy,
  paymentTargetConfigured,
  runFiberPayment,
  validExecutionToken,
} from "@/lib/server/fiber-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let lastProofAt = 0;

export async function GET() {
  const policy = paymentPolicy();
  return NextResponse.json({ ...policy, targetConfigured: paymentTargetConfigured() }, {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const policy = paymentPolicy();
  if (!policy.enabled) return failure(403, "Fiber payment proof is disabled.");
  if (!paymentTargetConfigured()) return failure(503, "Trusted Fiber payment target is not configured.");

  let body: { amountCkb?: unknown; requestId?: unknown; execute?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure(400, "Invalid JSON body.");
  }

  const amountCkb = Number(body.amountCkb);
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const execute = body.execute === true;
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
  if (execute && !validExecutionToken(bearer)) {
    return failure(403, "A valid operator token is required for live execution.");
  }

  const now = Date.now();
  if (now - lastProofAt < policy.cooldownMs) {
    return NextResponse.json(
      { error: "Payment proof cooldown is active.", retryAfterMs: policy.cooldownMs - (now - lastProofAt) },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }
  lastProofAt = now;

  const snapshot = await fetchPublicFiberSnapshot();
  if (!snapshot.reachable || !snapshot.node?.synced || snapshot.peerCount === 0) {
    return failure(409, "Fiber node is not ready for a payment attempt.");
  }
  if (snapshot.maxSendableCkb < amountCkb) {
    return failure(409, "Ready channels do not have enough outbound CKB liquidity.");
  }

  try {
    const receipt = await runFiberPayment({ amountCkb, requestId, execute });
    return NextResponse.json(receipt, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error("Fiber payment command failed");
    return failure(502, "Fiber payment proof failed. Check node, peer, channel, and CLI readiness.");
  }
}

function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
