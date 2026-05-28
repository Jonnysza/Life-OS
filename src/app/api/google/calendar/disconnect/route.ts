import { NextRequest, NextResponse } from "next/server";
import { disconnectGoogleCalendar } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    await disconnectGoogleCalendar(sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Disconnect failed." },
      { status: 500 }
    );
  }
}
