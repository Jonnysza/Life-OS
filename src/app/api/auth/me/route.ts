import { NextRequest, NextResponse } from "next/server";
import { getIdentity, googleAuthConfigured } from "@/lib/google/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  const identity = await getIdentity(sessionId);
  return NextResponse.json({
    configured: googleAuthConfigured(),
    loggedIn: !!identity,
    email: identity?.email ?? null,
    name: identity?.name ?? null,
    picture: identity?.picture ?? null,
  });
}
