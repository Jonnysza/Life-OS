import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const origin = req.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      `${origin}/?login_error=${encodeURIComponent(error)}`
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/?login_error=missing_params`);
  }
  try {
    const { returnTo } = await handleCallback(code, state, origin);
    const url = new URL(returnTo);
    url.searchParams.set("login", "success");
    return NextResponse.redirect(url.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return NextResponse.redirect(
      `${origin}/?login_error=${encodeURIComponent(msg)}`
    );
  }
}
