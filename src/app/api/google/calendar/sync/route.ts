import { NextRequest, NextResponse } from "next/server";
import {
  type LifeOsCalendarBlock,
  syncLifeOsBlocksToGoogle,
} from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBlock = LifeOsCalendarBlock;

function sanitize(blocks: IncomingBlock[]): LifeOsCalendarBlock[] {
  const now = Date.now();
  const horizon = now + 14 * 24 * 60 * 60 * 1000;
  return blocks
    .filter(
      (block) =>
        block &&
        typeof block.todoId === "string" &&
        typeof block.title === "string" &&
        typeof block.date === "string" &&
        typeof block.time === "string" &&
        typeof block.scheduledFor === "number" &&
        block.scheduledFor > now &&
        block.scheduledFor <= horizon
    )
    .map((block) => ({
      todoId: block.todoId,
      title: block.title.slice(0, 200),
      date: block.date,
      time: block.time,
      durationMinutes:
        typeof block.durationMinutes === "number"
          ? Math.max(15, Math.min(480, block.durationMinutes))
          : undefined,
      kind: block.kind === "event" ? "event" : "todo",
      scheduledFor: block.scheduledFor,
    }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "").trim();
    const blocks = Array.isArray(body?.blocks) ? sanitize(body.blocks) : [];
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    const result = await syncLifeOsBlocksToGoogle(sessionId, blocks);
    return NextResponse.json({ ok: result.errors.length === 0, total: blocks.length, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Google Calendar sync failed.";
    const status =
      message.includes("not connected") || message.includes("reconnected") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
