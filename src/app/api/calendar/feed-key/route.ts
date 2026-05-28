import { NextRequest, NextResponse } from "next/server";
import { resolveOwnerId } from "@/lib/auth/owner";
import { getOrCreateFeedKeyForOwner } from "@/lib/calendar/feedKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    const ownerId = await resolveOwnerId(sessionId);
    if (!ownerId.startsWith("acct:")) {
      return NextResponse.json({ ok: true, account: false });
    }
    const feedKey = await getOrCreateFeedKeyForOwner(ownerId);
    if (!feedKey) {
      return NextResponse.json({ error: "Redis is not configured." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, account: true, feedKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

