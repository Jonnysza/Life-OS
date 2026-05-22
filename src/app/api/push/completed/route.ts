import { NextRequest, NextResponse } from "next/server";
import { takeCompletedAcks } from "@/lib/push/scheduler";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const todoIds = await takeCompletedAcks(sessionId);
  return NextResponse.json({ todoIds });
}
