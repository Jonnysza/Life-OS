"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CalendarCheck,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCcw,
  Send,
  Unlink,
} from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { calendarFeedUrl, syncScheduleToServer } from "@/lib/push/client";
import {
  ensurePushSubscriptionRegistered,
  getCurrentSubscription,
  pushSupported,
  registerServiceWorker,
  sendTestPush,
  subscribePush,
} from "@/lib/push/client";
import { getSessionId } from "@/lib/session";
import { fetchMe, loginUrl, type Me } from "@/lib/sync/client";
import {
  disconnectGoogleCalendar,
  googleCalendarStatus,
  importGoogleCalendar,
  syncGoogleCalendar,
  type CalendarSyncBlock,
  type GoogleCalendarStatus,
} from "@/lib/google/client";
import { fromDateKey } from "@/lib/utils";

type BusyState =
  | "refresh"
  | "sync"
  | "notify"
  | "test"
  | "copy"
  | "import"
  | "disconnect"
  | null;

function scheduledFor(date: string, time: string): number {
  const d = fromDateKey(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "off";
  children: ReactNode;
}) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
        tone === "ok"
          ? "bg-[var(--success)]/15 text-[var(--success)]"
          : tone === "warn"
            ? "bg-[var(--danger)]/12 text-[var(--danger)]"
            : "bg-[var(--surface)] text-[var(--muted)]"
      }`}
    >
      {children}
    </span>
  );
}

export function ConnectedSystemsSection() {
  const todos = useStore((s) => s.todos);
  const events = useStore((s) => s.events);
  const upsertGoogleEvents = useStore((s) => s.upsertGoogleEvents);
  const [me, setMe] = useState<Me | null>(null);
  const [calendar, setCalendar] = useState<GoogleCalendarStatus | null>(null);
  const [pushOk, setPushOk] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState<number | null>(null);

  const blocks = useMemo<CalendarSyncBlock[]>(() => {
    if (nowMs === null) return [];
    const horizon = nowMs + 14 * 24 * 60 * 60 * 1000;
    const out: CalendarSyncBlock[] = [];

    for (const todo of todos) {
      if (!todo.time || todo.done) continue;
      const at = scheduledFor(todo.date, todo.time);
      if (at <= nowMs || at > horizon) continue;
      out.push({
        todoId: todo.id,
        title: todo.title,
        date: todo.date,
        time: todo.time,
        durationMinutes: todo.durationMinutes,
        kind: "todo",
        scheduledFor: at,
      });
    }

    for (const event of events) {
      if (!event.time || event.source === "google") continue;
      const at = scheduledFor(event.date, event.time);
      if (at <= nowMs || at > horizon) continue;
      out.push({
        todoId: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        durationMinutes: event.durationMinutes,
        kind: "event",
        scheduledFor: at,
      });
    }

    return out.sort((a, b) => a.scheduledFor - b.scheduledFor);
  }, [events, nowMs, todos]);

  async function refresh() {
    setBusy((current) => current ?? "refresh");
    setNowMs(Date.now());
    try {
      const [freshMe, freshCalendar] = await Promise.all([
        fetchMe(),
        googleCalendarStatus().catch(() => ({
          configured: false,
          redis: false,
          connected: false,
        })),
      ]);
      setMe(freshMe);
      setCalendar(freshCalendar);

      let nextFeedUrl = calendarFeedUrl();
      if (freshMe.loggedIn) {
        const res = await fetch(
          `/api/calendar/feed-key?sessionId=${encodeURIComponent(getSessionId())}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && typeof data?.feedKey === "string") {
          nextFeedUrl = `${window.location.origin}/api/calendar/ics?feedKey=${encodeURIComponent(data.feedKey)}`;
        }
      }
      setFeedUrl(nextFeedUrl);

      if (pushSupported()) {
        setPushOk(true);
        setPermission(Notification.permission);
        await registerServiceWorker();
        const sub = await getCurrentSubscription();
        setSubscribed(Boolean(sub));
        if (sub) await ensurePushSubscriptionRegistered();
      } else {
        setPushOk(false);
      }
    } finally {
      setBusy((current) => (current === "refresh" ? null : current));
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function enableNotifications() {
    setBusy("notify");
    setMessage("");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setMessage("Notification permission is blocked. Enable it in browser settings.");
        return;
      }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        setMessage("VAPID public key is missing.");
        return;
      }
      await subscribePush(vapid);
      setSubscribed(true);
      window.dispatchEvent(new Event("life-os:force-schedule-sync"));
      setMessage("Notifications are on. Timed tasks are now eligible for reminders.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(null);
    }
  }

  async function copyFeed() {
    if (!feedUrl) return;
    setBusy("copy");
    await navigator.clipboard.writeText(feedUrl);
    setMessage("Calendar feed copied.");
    setTimeout(() => setBusy(null), 700);
  }

  async function syncNow() {
    setBusy("sync");
    setMessage("");
    try {
      const schedule = await syncScheduleToServer(blocks);
      if (blocks.length > 0 && schedule?.enabled === false) {
        setMessage("Redis schedule storage is not configured for this environment.");
        return;
      }

      if (calendar?.connected && calendar.accountScoped && !calendar.needsReconnect) {
        const result = await syncGoogleCalendar(blocks);
        const changed =
          (result.created ?? 0) + (result.updated ?? 0) + (result.deleted ?? 0);
        setMessage(
          changed || blocks.length
            ? `Synced ${blocks.length} timed item${blocks.length === 1 ? "" : "s"} to Google.`
            : "Schedule is connected. Add timed tasks to sync more."
        );
      } else {
        setMessage("Schedule storage synced. Connect Google to push real Calendar events.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  async function testNotifications() {
    setBusy("test");
    setMessage("");
    try {
      const registered = await ensurePushSubscriptionRegistered();
      window.dispatchEvent(new Event("life-os:force-schedule-sync"));
      if (!registered) {
        setMessage("This device is not subscribed. Enable notifications first.");
        return;
      }
      const res = await sendTestPush({
        title: "Life OS check",
        body: "This device is connected to reminder delivery.",
      });
      if (res.error) setMessage(res.error);
      else setMessage(`Notification check sent to ${res.sent} device${res.sent === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notification check failed.");
    } finally {
      setBusy(null);
    }
  }

  async function importEvents() {
    setBusy("import");
    setMessage("");
    try {
      const imported = await importGoogleCalendar(14);
      upsertGoogleEvents(imported);
      setMessage(
        imported.length
          ? `Imported ${imported.length} Google event${imported.length === 1 ? "" : "s"}.`
          : "No new Google events found for the next 14 days."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google import failed.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnectCalendar() {
    setBusy("disconnect");
    setMessage("");
    try {
      await disconnectGoogleCalendar();
      setMessage("Google Calendar disconnected.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  }

  const accountReady = Boolean(me?.loggedIn);
  const googleConfigured = Boolean(me?.configured);
  const redisReady = Boolean(calendar?.redis);
  const calendarReady = Boolean(
    calendar?.connected && calendar.accountScoped && !calendar.needsReconnect
  );
  const notificationsReady = pushOk && subscribed;
  const everythingReady = accountReady && calendarReady && notificationsReady;

  const primary = !googleConfigured
    ? { label: "Google keys missing", href: "", disabled: true }
    : !accountReady
      ? { label: "Connect Google + Calendar", href: loginUrl(), disabled: false }
      : !calendarReady
        ? { label: "Reconnect Google access", href: loginUrl(), disabled: false }
        : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Connected system
        </h3>
        <button
          onClick={refresh}
          disabled={busy !== null}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1.5 disabled:opacity-40"
        >
          {busy === "refresh" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
          Refresh
        </button>
      </div>

      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
            {everythingReady ? <CheckCircle2 size={18} /> : <Cloud size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">Life OS connection hub</p>
              <StatusPill tone={everythingReady ? "ok" : "off"}>
                {everythingReady ? "all connected" : "setup needed"}
              </StatusPill>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed mt-1">
              One Google account owns app sync, Calendar sync, feed links, and
              reminder delivery across phone and desktop.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2.5">
            <div className="flex items-center gap-2">
              {accountReady ? (
                <Cloud size={14} className="text-[var(--success)]" />
              ) : (
                <CloudOff size={14} className="text-[var(--muted)]" />
              )}
              <p className="text-xs font-semibold">Google account</p>
              <StatusPill tone={accountReady ? "ok" : googleConfigured ? "off" : "warn"}>
                {accountReady ? "signed in" : googleConfigured ? "not signed in" : "missing keys"}
              </StatusPill>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1 truncate">
              {me?.email ?? "Required for cross-device sync."}
            </p>
          </div>

          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2.5">
            <div className="flex items-center gap-2">
              <CalendarCheck
                size={14}
                className={calendarReady ? "text-[var(--success)]" : "text-[var(--muted)]"}
              />
              <p className="text-xs font-semibold">Google Calendar</p>
              <StatusPill tone={calendarReady ? "ok" : redisReady ? "off" : "warn"}>
                {calendarReady ? "connected" : redisReady ? "not connected" : "redis missing"}
              </StatusPill>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              {blocks.length} timed item{blocks.length === 1 ? "" : "s"} ready to mirror.
            </p>
          </div>

          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2.5">
            <div className="flex items-center gap-2">
              {notificationsReady ? (
                <Bell size={14} className="text-[var(--success)]" />
              ) : (
                <BellOff size={14} className="text-[var(--muted)]" />
              )}
              <p className="text-xs font-semibold">Phone reminders</p>
              <StatusPill tone={notificationsReady ? "ok" : pushOk ? "off" : "warn"}>
                {notificationsReady ? "on" : pushOk ? permission : "unsupported"}
              </StatusPill>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              Timed tasks can send Done / 5 min reminders.
            </p>
          </div>

          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2.5">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-[var(--success)]" />
              <p className="text-xs font-semibold">Live calendar feed</p>
              <StatusPill tone="ok">active</StatusPill>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              Copy once into Google Calendar if you prefer feed sync.
            </p>
          </div>
        </div>

        {!googleConfigured && (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/25 p-2.5">
            <AlertTriangle size={13} className="text-[var(--danger)] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[var(--danger)] leading-relaxed">
              Google is not configured in Vercel. Add GOOGLE_CLIENT_ID and
              GOOGLE_CLIENT_SECRET, then reconnect. Your app cannot complete
              Google sign-in or Calendar sync without those two keys.
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {primary ? (
            primary.disabled ? (
              <button
                disabled
                className="sm:col-span-2 px-3 py-2 rounded-lg bg-[var(--border)] text-[var(--muted)] text-sm disabled:opacity-60"
              >
                {primary.label}
              </button>
            ) : (
              <motion.a
                whileTap={{ scale: 0.97 }}
                href={primary.href}
                className="sm:col-span-2 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} />
                {primary.label}
              </motion.a>
            )
          ) : (
            <button
              onClick={syncNow}
              disabled={busy === "sync"}
              className="sm:col-span-2 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Sync everything now
            </button>
          )}

          {!notificationsReady && pushOk && (
            <button
              onClick={enableNotifications}
              disabled={busy === "notify" || permission === "denied"}
              className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy === "notify" ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
              Enable reminders
            </button>
          )}
          {notificationsReady && (
            <button
              onClick={testNotifications}
              disabled={busy === "test"}
              className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy === "test" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Test reminders
            </button>
          )}
          <button
            onClick={copyFeed}
            disabled={!feedUrl || busy === "copy"}
            className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === "copy" ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            Copy feed
          </button>
          {calendarReady && (
            <>
              <button
                onClick={importEvents}
                disabled={busy === "import"}
                className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy === "import" ? <Loader2 size={13} className="animate-spin" /> : <CalendarCheck size={13} />}
                Import Google
              </button>
              <button
                onClick={disconnectCalendar}
                disabled={busy === "disconnect"}
                className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--danger)]/15 text-[var(--danger)] text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Unlink size={13} />
                Disconnect Calendar
              </button>
            </>
          )}
        </div>

        {message && (
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
