import { NextRequest, NextResponse } from "next/server";
import { getWebPush } from "@/lib/push/webpush";
import { listSubscriptions, removeSubscription } from "@/lib/push/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title ?? "Life OS";
    const text = body.body ?? "Hello from Life OS";
    const url = body.url ?? "/";
    const tag = body.tag;
    const wp = getWebPush();
    const subs = listSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ error: "No subscriptions" }, { status: 404 });
    }
    const payload = JSON.stringify({ title, body: text, url, tag });
    const results = await Promise.allSettled(
      subs.map((s) => wp.sendNotification(s, payload))
    );
    let sent = 0;
    let removed = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        sent++;
      } else {
        const reason = r.reason as { statusCode?: number };
        if (reason?.statusCode === 410 || reason?.statusCode === 404) {
          removeSubscription(subs[i].endpoint);
          removed++;
        }
      }
    });
    return NextResponse.json({ ok: true, sent, removed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
