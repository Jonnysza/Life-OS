import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/lib/google/identity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = String(body?.sessionId ?? "").trim();
  await logout(sessionId);
  return NextResponse.json({ ok: true });
}
