import { NextRequest, NextResponse } from "next/server";
import { syncOwnerSchedule } from "@/lib/push/scheduler";
import { redisAvailable } from "@/lib/push/redis";
import { resolveOwnerId } from "@/lib/auth/owner";

export const runtime = "nodejs";

type IncomingBlock = {
  todoId: string;
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  kind?: "todo" | "event";
  scheduledFor: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "").trim();
    const blocks: IncomingBlock[] = Array.isArray(body?.blocks)
      ? body.blocks
      : [];
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    const ownerId = await resolveOwnerId(sessionId);
    const now = Date.now();
    const sanitized = blocks
      .filter(
        (b) =>
          b &&
          typeof b.todoId === "string" &&
          typeof b.title === "string" &&
          typeof b.scheduledFor === "number" &&
          b.scheduledFor > now
      )
      .map((b) => ({
        todoId: b.todoId,
        title: b.title,
        date: b.date,
        time: b.time,
        durationMinutes: b.durationMinutes,
        kind: b.kind ?? "todo",
        scheduledFor: b.scheduledFor,
      }));
    const result = await syncOwnerSchedule(ownerId, sanitized);
    return NextResponse.json({
      ok: true,
      enabled: redisAvailable(),
      ...result,
      total: sanitized.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
