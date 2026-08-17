import { NextRequest, NextResponse } from "next/server";
import { issuePaymentGrant } from "@/lib/server/payment-grant";
import { validExecutionToken } from "@/lib/server/fiber-payment";
import { claimCooldown } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!validExecutionToken(bearer)) {
    return NextResponse.json(
      { error: "A valid operator token is required to issue a payment grant." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  if (process.env.FIBER_PAYMENT_EXECUTION_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Live Fiber execution is disabled on this deployment." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  let body: { requestId?: unknown; amountCkb?: unknown; invoice?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const amountCkb = Number(body.amountCkb);
  const invoice = typeof body.invoice === "string" ? body.invoice.trim() : undefined;
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(requestId)) {
    return NextResponse.json({ error: "A valid payment request ID is required." }, {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }
  if (!Number.isFinite(amountCkb) || amountCkb <= 0) {
    return NextResponse.json({ error: "Payment grant amount is invalid." }, {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }
  const slot = claimCooldown("grant-issue", Number(process.env.FIBER_GRANT_COOLDOWN_MS ?? 1000));
  if (!slot.ok) {
    return NextResponse.json(
      { error: "Grant issue cooldown is active.", retryAfterMs: slot.retryAfterMs },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const issued = issuePaymentGrant({ requestId, amountCkb, invoice });
    return NextResponse.json(
      {
        issued: true,
        grant: issued.grant,
        expiresAt: issued.expiresAt,
        requestId,
        amountCkb,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Payment grant could not be issued." }, {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }
}
