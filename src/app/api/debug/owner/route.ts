import { NextRequest, NextResponse } from "next/server";
import { resolveOwnerId } from "@/lib/auth/owner";
import { getIdentity } from "@/lib/google/identity";
import { redisAvailable } from "@/lib/push/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    const ownerId = await resolveOwnerId(sessionId);
    const identity = await getIdentity(sessionId);
    return NextResponse.json({
      ok: true,
      redis: redisAvailable(),
      ownerId,
      loggedIn: Boolean(identity?.googleUserId),
      email: identity?.email ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

