import { NextRequest, NextResponse } from "next/server";
import {
  markCompleted,
  rescheduleSnooze,
  cancelNotification,
} from "@/lib/push/scheduler";
import { resolveOwnerId } from "@/lib/auth/owner";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "").trim();
    const ownerIdRaw = typeof body?.ownerId === "string" ? body.ownerId.trim() : "";
    const todoId = String(body?.todoId ?? "").trim();
    const action = String(body?.action ?? "").trim();
    if ((!sessionId && !ownerIdRaw) || !todoId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const ownerId = ownerIdRaw || (await resolveOwnerId(sessionId));
    if (action === "done") {
      await markCompleted(ownerId, todoId);
      return NextResponse.json({ ok: true, action: "done" });
    }
    if (action === "snooze") {
      const minutes = Number(body?.minutes ?? 5);
      const updated = await rescheduleSnooze(ownerId, todoId, minutes);
      return NextResponse.json({
        ok: true,
        action: "snooze",
        snoozeCount: updated?.snoozeCount ?? 0,
      });
    }
    if (action === "dismiss") {
      await cancelNotification(ownerId, todoId);
      return NextResponse.json({ ok: true, action: "dismiss" });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
