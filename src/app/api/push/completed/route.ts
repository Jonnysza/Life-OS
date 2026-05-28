import { NextRequest, NextResponse } from "next/server";
import { takeCompletedAcks } from "@/lib/push/scheduler";
import { resolveOwnerId } from "@/lib/auth/owner";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const ownerId = await resolveOwnerId(sessionId);
  const todoIds = await takeCompletedAcks(ownerId);
  return NextResponse.json({ todoIds });
}
