import { NextRequest, NextResponse } from "next/server";
import { listScheduledForOwner } from "@/lib/push/scheduler";
import { ownerIdForFeedKey } from "@/lib/calendar/feedKey";
import { resolveOwnerId } from "@/lib/auth/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function stamp(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function lineFold(line: string) {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

export async function GET(req: NextRequest) {
  const feedKey = req.nextUrl.searchParams.get("feedKey")?.trim();
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  let ownerId: string | null = null;

  if (feedKey) {
    ownerId = await ownerIdForFeedKey(feedKey);
    if (!ownerId) return new NextResponse("Invalid feedKey", { status: 400 });
  } else if (sessionId) {
    ownerId = await resolveOwnerId(sessionId);
  } else {
    return new NextResponse("Missing sessionId", { status: 400 });
  }

  if (!ownerId) return new NextResponse("Missing ownerId", { status: 400 });
  const items = await listScheduledForOwner(ownerId);
  const now = stamp(Date.now());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Life OS//Goal Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Life OS",
    "X-WR-CALDESC:Scheduled tasks and events from Life OS",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const item of items) {
    const start = item.scheduledFor;
    const end = start + (item.durationMinutes ?? (item.kind === "event" ? 60 : 30)) * 60_000;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${esc(item.ownerId)}-${esc(item.todoId)}@life-os`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(item.kind === "todo" ? `Task: ${item.title}` : item.title)}`,
      `DESCRIPTION:${esc("Created by Life OS. Complete or snooze this inside the Life OS app.")}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "BEGIN:VALARM",
      "TRIGGER:-PT5M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(item.title)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  const body = lines.map(lineFold).join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
