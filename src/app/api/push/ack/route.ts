import { NextRequest, NextResponse } from "next/server";
import {
  markCompleted,
  rescheduleSnooze,
  cancelNotification,
} from "@/lib/push/scheduler";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "").trim();
    const todoId = String(body?.todoId ?? "").trim();
    const action = String(body?.action ?? "").trim();
    if (!sessionId || !todoId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (action === "done") {
      await markCompleted(sessionId, todoId);
      return NextResponse.json({ ok: true, action: "done" });
    }
    if (action === "snooze") {
      const minutes = Number(body?.minutes ?? 5);
      const updated = await rescheduleSnooze(sessionId, todoId, minutes);
      return NextResponse.json({
        ok: true,
        action: "snooze",
        snoozeCount: updated?.snoozeCount ?? 0,
      });
    }
    if (action === "dismiss") {
      await cancelNotification(sessionId, todoId);
      return NextResponse.json({ ok: true, action: "dismiss" });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
