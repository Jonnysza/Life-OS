import { NextRequest, NextResponse } from "next/server";
import { fetchDueNotifications, markFired } from "@/lib/push/scheduler";
import { listSubscriptionsForSession, removeSubscription } from "@/lib/push/store";
import { getWebPush } from "@/lib/push/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function payloadForNotification(notif: {
  todoId: string;
  title: string;
  snoozeCount: number;
  kind: "todo" | "event";
  durationMinutes?: number;
  time: string;
}) {
  const escalation = notif.snoozeCount;
  let prefix = "";
  let urgent = false;
  if (escalation >= 3) {
    prefix = "🚨 STILL not done — ";
    urgent = true;
  } else if (escalation >= 1) {
    prefix = `⏰ Reminder #${escalation + 1} — `;
    urgent = escalation >= 2;
  } else {
    prefix = notif.kind === "event" ? "📅 " : "⏱ ";
  }
  const verb = notif.kind === "event" ? "Starting now" : "Time for";
  const body =
    notif.kind === "event"
      ? `${notif.time}${notif.durationMinutes ? ` · ${notif.durationMinutes}m` : ""}`
      : `Scheduled at ${notif.time}${notif.durationMinutes ? ` for ${notif.durationMinutes}m` : ""}. Did you do it?`;
  const vibrate = urgent
    ? [400, 100, 400, 100, 400, 100, 600]
    : escalation >= 1
      ? [250, 100, 250, 100, 250]
      : [120, 60, 120];
  return {
    title: `${prefix}${notif.title}`,
    body: `${verb}: ${body}`,
    tag: `block-${notif.todoId}`,
    requireInteraction: urgent,
    vibrate,
    actions: [
      { action: "done", title: "✅ Done" },
      { action: "snooze", title: "💤 5 min" },
    ],
    data: { todoId: notif.todoId, kind: notif.kind, escalation, verb },
  };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = Date.now();
    const due = await fetchDueNotifications(now + 30_000, 100);
    if (due.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0 });
    }
    const wp = getWebPush();
    let sent = 0;
    let removed = 0;
    let noSubs = 0;
    for (const notif of due) {
      const subs = await listSubscriptionsForSession(notif.sessionId);
      if (subs.length === 0) {
        await markFired(notif.sessionId, notif.todoId);
        noSubs++;
        continue;
      }
      const payload = JSON.stringify({
        ...payloadForNotification(notif),
        sessionId: notif.sessionId,
      });
      const results = await Promise.allSettled(
        subs.map((s) => wp.sendNotification(s, payload))
      );
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled") sent++;
        else {
          const reason = r.reason as { statusCode?: number };
          if (reason?.statusCode === 410 || reason?.statusCode === 404) {
            await removeSubscription(subs[i].endpoint);
            removed++;
          }
        }
      }
      await markFired(notif.sessionId, notif.todoId);
    }
    return NextResponse.json({
      ok: true,
      scanned: due.length,
      sent,
      removed,
      noSubs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
