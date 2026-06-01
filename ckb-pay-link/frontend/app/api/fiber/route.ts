import { NextResponse } from "next/server";

const DEFAULT_FIBER_RPC = "http://127.0.0.1:8227";

export async function POST(req: Request) {
  let body: { method?: string; params?: unknown[]; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const method = body.method;
  if (!method || typeof method !== "string") {
    return NextResponse.json(
      { error: { message: "Missing method" } },
      { status: 400 },
    );
  }

  const fiberUrl =
    body.url ?? process.env.FIBER_RPC_URL ?? DEFAULT_FIBER_RPC;
  const params = Array.isArray(body.params) ? body.params : [];

  try {
    const res = await fetch(fiberUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Date.now(),
        jsonrpc: "2.0",
        method,
        params,
      }),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.ok ? 200 : 502 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Fiber RPC failed";
    return NextResponse.json({ error: { message } }, { status: 502 });
  }
}
