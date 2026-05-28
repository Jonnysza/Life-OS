import { NextRequest, NextResponse } from "next/server";
import { completeGoogleCalendarOAuth } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (error) {
    const target = new URL("/", req.nextUrl.origin);
    target.searchParams.set("google_calendar_error", error);
    return NextResponse.redirect(target);
  }

  try {
    if (!code || !state) throw new Error("Google did not return an authorization code.");
    const stored = await completeGoogleCalendarOAuth(code, state, req.nextUrl.origin);
    const target = new URL(stored.returnTo);
    target.searchParams.set("google_calendar", "connected");
    return NextResponse.redirect(target);
  } catch (e) {
    const target = new URL("/", req.nextUrl.origin);
    target.searchParams.set(
      "google_calendar_error",
      e instanceof Error ? e.message : "Google Calendar connect failed."
    );
    return NextResponse.redirect(target);
  }
}
