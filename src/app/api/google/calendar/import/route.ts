import { NextRequest, NextResponse } from "next/server";
import { importGoogleCalendarEvents } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
    const days = Math.max(
      1,
      Math.min(30, Number(req.nextUrl.searchParams.get("days") ?? 14))
    );
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    const events = await importGoogleCalendarEvents(sessionId, days);
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Google Calendar import failed.";
    const status =
      message.includes("not connected") || message.includes("reconnected") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
