import { NextRequest, NextResponse } from "next/server";
import { getGoogleCalendarStatus } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  const status = await getGoogleCalendarStatus(sessionId);
  return NextResponse.json(status);
}
