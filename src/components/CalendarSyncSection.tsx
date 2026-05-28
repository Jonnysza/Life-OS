"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  Copy,
  ExternalLink,
  Link2,
  RefreshCcw,
  TestTube2,
  Unlink,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { calendarFeedUrl, syncScheduleToServer } from "@/lib/push/client";
import {
  disconnectGoogleCalendar,
  googleCalendarConnectUrl,
  googleCalendarStatus,
  importGoogleCalendar,
  syncGoogleCalendar,
  type CalendarSyncBlock,
  type GoogleCalendarStatus,
} from "@/lib/google/client";
import { fromDateKey } from "@/lib/utils";

type BusyState = "copy" | "test" | "sync" | "import" | "disconnect" | null;

function scheduledFor(date: string, time: string): number {
  const d = fromDateKey(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function CalendarSyncSection() {
  const todos = useStore((s) => s.todos);
  const events = useStore((s) => s.events);
  const upsertGoogleEvents = useStore((s) => s.upsertGoogleEvents);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
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

  async function refreshStatus() {
    try {
      setStatus(await googleCalendarStatus());
    } catch {
      setStatus({ configured: false, redis: false, connected: false });
    }
  }

  useEffect(() => {
    setUrl(calendarFeedUrl());
    refreshStatus();
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("google_calendar");
    const error = params.get("google_calendar_error");
    if (connected === "connected") setMessage("Google Calendar connected. Sync now will create real Google events.");
    if (error) setMessage(error);
    return () => clearInterval(timer);
  }, []);

  async function copy() {
    if (!url) return;
    setBusy("copy");
    await navigator.clipboard.writeText(url);
    setMessage("Calendar feed copied. Paste it into Google Calendar's From URL screen.");
    setTimeout(() => setBusy(null), 900);
  }

  async function testFeed() {
    if (!url) return;
    setBusy("test");
    try {
      const schedule = await syncScheduleToServer(blocks);
      if (blocks.length > 0 && schedule?.enabled === false) {
        setMessage("Calendar feed needs Redis schedule storage. Production has it; local dev does not.");
        return;
      }
      const res = await fetch(`${url}&t=${Date.now()}`, { cache: "no-store" });
      const text = await res.text();
      const count = (text.match(/BEGIN:VEVENT/g) ?? []).length;
      if (!res.ok || !text.includes("BEGIN:VCALENDAR")) {
        setMessage("Calendar feed did not respond correctly. Try again after saving a timed task.");
      } else if (count === 0) {
        setMessage("Feed works, but it has 0 timed items. Add a task with a reminder time first.");
      } else {
        setMessage(`Feed works. Google can see ${count} timed item${count === 1 ? "" : "s"}.`);
      }
    } catch {
      setMessage("Could not test the feed from this browser. Copy the link and open it once to check.");
    } finally {
      setBusy(null);
    }
  }

  function connect() {
    window.location.href = googleCalendarConnectUrl(window.location.href);
  }

  async function syncNow() {
    setBusy("sync");
    try {
      const schedule = await syncScheduleToServer(blocks);
      if (blocks.length > 0 && schedule?.enabled === false) {
        setMessage("Server schedule storage is not configured here. Add Redis env vars or use production.");
        return;
      }
      const result = await syncGoogleCalendar(blocks);
      const changed = (result.created ?? 0) + (result.updated ?? 0) + (result.deleted ?? 0);
      setMessage(
        changed || blocks.length
          ? `Synced ${blocks.length} timed Life OS item${blocks.length === 1 ? "" : "s"} to Google.`
          : "Nothing to sync yet. Add a task or event with a time."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Calendar sync failed.");
    } finally {
      setBusy(null);
    }
  }

  async function importEvents() {
    setBusy("import");
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

  async function disconnect() {
    setBusy("disconnect");
    try {
      await disconnectGoogleCalendar();
      await refreshStatus();
      setMessage("Google Calendar disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  }

  const connected = Boolean(status?.connected && !status?.needsReconnect);
  const canConnect = Boolean(status?.configured && status?.redis);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Google Calendar
        </h3>
        <span className="text-[10px] text-[var(--muted)]">
          {blocks.length} timed item{blocks.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
            <CalendarCheck size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Calendar connection status</p>
            <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
              The feed works now. Direct Google event editing turns on after Google OAuth keys are added.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={13} className="text-[var(--success)]" />
            <p className="text-xs font-semibold">Works now: live calendar feed</p>
            <span className="ml-auto text-[10px] text-[var(--success)]">active</span>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 text-xs text-[var(--muted)]"
            />
            <button
              onClick={copy}
              className="px-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)] text-xs flex items-center gap-1.5"
            >
              {busy === "copy" ? <Check size={12} /> : <Copy size={12} />}
              Copy
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={testFeed}
              disabled={busy === "test"}
              className="px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)] text-xs flex items-center justify-center gap-1.5"
            >
              <TestTube2 size={12} />
              Test feed
            </button>
            <a
              href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={12} />
              Open Google
            </a>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
            Add this once on Google Calendar desktop: Other calendars, From URL,
            paste the copied link. Google refreshes subscribed feeds on its own schedule.
          </p>
        </div>

        <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCcw size={13} className="text-[var(--accent)]" />
            <p className="text-xs font-semibold">Direct Google sync</p>
            <span
              className={`ml-auto text-[10px] ${connected ? "text-[var(--success)]" : "text-[var(--muted)]"}`}
            >
              {connected ? "connected" : canConnect ? "ready" : "not configured"}
            </span>
          </div>

          {!canConnect && (
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mb-2">
              Direct Google sync is off on this deployment because Google OAuth
              keys are not in Vercel yet. The live feed above is the working path today.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!connected ? (
              <button
                onClick={connect}
                disabled={!canConnect}
                className="col-span-2 px-3 py-2 rounded-lg bg-[var(--accent)] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={12} />
                Connect Google account
              </button>
            ) : (
              <>
                <button
                  onClick={syncNow}
                  disabled={busy === "sync"}
                  className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCcw size={12} />
                  Push to Google
                </button>
                <button
                  onClick={importEvents}
                  disabled={busy === "import"}
                  className="px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)] text-xs flex items-center justify-center gap-1.5"
                >
                  <CalendarCheck size={12} />
                  Import 14d
                </button>
                <button
                  onClick={disconnect}
                  disabled={busy === "disconnect"}
                  className="col-span-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--danger)]/15 text-xs flex items-center justify-center gap-1.5 text-[var(--danger)]"
                >
                  <Unlink size={12} />
                  Disconnect Google
                </button>
              </>
            )}
          </div>
        </div>

        {message && (
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">{message}</p>
        )}
      </div>
    </section>
  );
}
