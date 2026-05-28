"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Check,
  Copy,
  ExternalLink,
  Link2,
  RefreshCcw,
  Unlink,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { calendarFeedUrl } from "@/lib/push/client";
import {
  disconnectGoogleCalendar,
  googleCalendarConnectUrl,
  googleCalendarStatus,
  importGoogleCalendar,
  type GoogleCalendarStatus,
} from "@/lib/google/client";

type BusyState = "copy" | "sync" | "import" | "disconnect" | null;

export function CalendarSyncSection() {
  const upsertGoogleEvents = useStore((s) => s.upsertGoogleEvents);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");

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
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("google_calendar");
    const error = params.get("google_calendar_error");
    if (connected === "connected") setMessage("Google Calendar connected.");
    if (error) setMessage(error);
  }, []);

  async function copy() {
    if (!url) return;
    setBusy("copy");
    await navigator.clipboard.writeText(url);
    setMessage("Calendar feed copied.");
    setTimeout(() => setBusy(null), 900);
  }

  function connect() {
    window.location.href = googleCalendarConnectUrl(window.location.href);
  }

  async function syncNow() {
    setBusy("sync");
    window.dispatchEvent(new Event("life-os:force-schedule-sync"));
    setMessage("Sync requested. Timed Life OS blocks will push to Google if connected.");
    setTimeout(() => setBusy(null), 900);
  }

  async function importEvents() {
    setBusy("import");
    try {
      const events = await importGoogleCalendar(14);
      upsertGoogleEvents(events);
      setMessage(
        events.length
          ? `Imported ${events.length} Google event${events.length === 1 ? "" : "s"}.`
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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
        Google Calendar
      </h3>
      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
            <CalendarCheck size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Keep Life OS and Google lined up</p>
            <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
              Timed Life OS tasks/events can become Google events with popup reminders.
              The feed link below works immediately; OAuth sync enables real event writes.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={13} className="text-[var(--accent)]" />
            <p className="text-xs font-semibold">Calendar feed</p>
            <span className="ml-auto text-[10px] text-[var(--muted)]">one-way</span>
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
          <p className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
            Google Calendar: Other calendars, From URL, paste this link. Google
            may refresh subscribed calendars slowly, so Life OS push remains the
            instant reminder layer.
          </p>
        </div>

        <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCcw size={13} className="text-[var(--accent)]" />
            <p className="text-xs font-semibold">Native Google sync</p>
            <span
              className={`ml-auto text-[10px] ${connected ? "text-[var(--success)]" : "text-[var(--muted)]"}`}
            >
              {connected ? "connected" : canConnect ? "ready" : "needs keys"}
            </span>
          </div>

          {!canConnect && (
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mb-2">
              Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel to turn
              on direct Google event creation/import. The feed link still works.
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
                Connect Google
              </button>
            ) : (
              <>
                <button
                  onClick={syncNow}
                  disabled={busy === "sync"}
                  className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCcw size={12} />
                  Sync now
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
