import { NextRequest, NextResponse } from "next/server";
import { pullState, pushState } from "@/lib/google/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  const result = await pullState(sessionId);
  if (!result) {
    return NextResponse.json({ ok: true, hasState: false });
  }
  return NextResponse.json({
    ok: true,
    hasState: true,
    blob: result.blob,
    updatedAt: result.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "").trim();
    const blob = String(body?.blob ?? "");
    const updatedAt = Number(body?.updatedAt ?? Date.now());
    const device = typeof body?.device === "string" ? body.device : undefined;
    if (!sessionId || !blob) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const result = await pushState(sessionId, blob, updatedAt, device);
    if (!result.ok && result.conflict) {
      return NextResponse.json(
        { ok: false, conflict: true, updatedAt: result.updatedAt },
        { status: 409 }
      );
    }
    if (!result.ok) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
