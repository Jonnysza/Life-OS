import { NextRequest, NextResponse } from "next/server";
import { createLoginUrl } from "@/lib/google/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  const returnTo = req.nextUrl.searchParams.get("returnTo");
  try {
    const url = await createLoginUrl(sessionId, returnTo, req.nextUrl.origin);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login error";
    return NextResponse.redirect(
      `${req.nextUrl.origin}/?login_error=${encodeURIComponent(msg)}`
    );
  }
}
