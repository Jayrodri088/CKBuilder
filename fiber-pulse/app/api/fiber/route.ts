import { NextRequest, NextResponse } from "next/server";
import { fetchPublicFiberSnapshot } from "@/lib/server/fiber-rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await fetchPublicFiberSnapshot();
  return NextResponse.json(snapshot, {
    status: snapshot.reachable ? 200 : 502,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body && typeof body === "object" && "method" in body) {
    return NextResponse.json(
      { error: "Direct Fiber RPC methods are not accepted by this endpoint." },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { error: "Use GET /api/fiber for the public read-only snapshot." },
    { status: 405, headers: { allow: "GET" } },
  );
}
