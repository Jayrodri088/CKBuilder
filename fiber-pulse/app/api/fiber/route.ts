import { NextRequest, NextResponse } from "next/server";

const FIBER_RPC =
  process.env.FIBER_RPC_URL ?? process.env.NEXT_PUBLIC_FIBER_RPC_URL ?? "http://127.0.0.1:8227";

export async function POST(req: NextRequest) {
  let body: { method?: string; params?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.method) {
    return NextResponse.json({ error: "method required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(FIBER_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: body.method,
        params: body.params ?? [],
      }),
      signal: AbortSignal.timeout(4000),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          message:
            e instanceof Error
              ? e.message
              : `Fiber RPC unreachable at ${FIBER_RPC}`,
        },
      },
      { status: 502 },
    );
  }
}
