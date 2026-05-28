import { NextRequest, NextResponse } from "next/server";
import { createGoogleCalendarAuthUrl } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  const returnTo = req.nextUrl.searchParams.get("returnTo");
  try {
    const url = await createGoogleCalendarAuthUrl(sessionId, returnTo, req.nextUrl.origin);
    return NextResponse.redirect(url);
  } catch (error) {
    const requested = new URL(returnTo || "/", req.nextUrl.origin);
    const target =
      requested.origin === req.nextUrl.origin
        ? requested
        : new URL("/", req.nextUrl.origin);
    target.searchParams.set(
      "google_calendar_error",
      error instanceof Error ? error.message : "Google Calendar connect failed."
    );
    return NextResponse.redirect(target);
  }
}
