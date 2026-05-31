"use client";

import { getSessionId } from "@/lib/session";

export type CalendarSyncBlock = {
  todoId: string;
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  kind: "todo" | "event";
  scheduledFor: number;
};

export type GoogleCalendarStatus = {
  configured: boolean;
  redis: boolean;
  connected: boolean;
  ownerId?: string;
  accountScoped?: boolean;
  needsReconnect?: boolean;
};

export type ImportedGoogleEvent = {
  externalId: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  source: "google";
  htmlLink?: string;
};

export function googleCalendarConnectUrl(returnTo?: string): string {
  const params = new URLSearchParams({
    sessionId: getSessionId(),
    returnTo:
      returnTo ??
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
  });
  return `/api/google/calendar/auth?${params}`;
}

export async function googleCalendarStatus(): Promise<GoogleCalendarStatus> {
  const res = await fetch(
    `/api/google/calendar/status?sessionId=${encodeURIComponent(getSessionId())}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Could not check Google Calendar status.");
  return res.json();
}

export async function syncGoogleCalendar(blocks: CalendarSyncBlock[]) {
  const res = await fetch("/api/google/calendar/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId(), blocks }),
  });
  const data = await res.json().catch(() => ({}));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("life-os:google-sync", { detail: data }));
  }
  if (!res.ok) throw new Error(data?.error ?? "Google Calendar sync failed.");
  return data;
}

export async function importGoogleCalendar(days = 14): Promise<ImportedGoogleEvent[]> {
  const res = await fetch(
    `/api/google/calendar/import?sessionId=${encodeURIComponent(getSessionId())}&days=${days}`,
    { cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Google Calendar import failed.");
  return Array.isArray(data.events) ? data.events : [];
}

export async function disconnectGoogleCalendar() {
  const res = await fetch("/api/google/calendar/disconnect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Google Calendar disconnect failed.");
  return data;
}
