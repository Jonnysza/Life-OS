"use client";

import { getSessionId } from "@/lib/session";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function ensurePushSubscriptionRegistered(): Promise<boolean> {
  const sub = await getCurrentSubscription();
  if (!sub) return false;
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...sub.toJSON(),
      sessionId: getSessionId(),
    }),
  });
  return true;
}

export async function subscribePush(
  vapidPublicKey: string
): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  let sub = existing;
  if (!sub) {
    const key = urlBase64ToUint8Array(vapidPublicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer as ArrayBuffer,
    });
  }
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...sub.toJSON(),
      sessionId: getSessionId(),
    }),
  });
  return sub;
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export async function sendTestPush(body?: { title?: string; body?: string }) {
  const res = await fetch("/api/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: body?.title ?? "Life OS",
      body: body?.body ?? "Test notification — you're all set up.",
      sessionId: getSessionId(),
    }),
  });
  return res.json();
}

export async function syncScheduleToServer(
  blocks: {
    todoId: string;
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    kind: "todo" | "event";
    scheduledFor: number;
  }[]
) {
  try {
    const res = await fetch("/api/push/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: getSessionId(), blocks }),
    });
    const data = await res.json();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("life-os:schedule-sync", { detail: data })
      );
    }
    return data;
  } catch (e) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("life-os:schedule-sync", {
          detail: { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
        })
      );
    }
    return null;
  }
}

export async function pollCompletedFromServer(): Promise<string[]> {
  try {
    const res = await fetch(
      `/api/push/completed?sessionId=${encodeURIComponent(getSessionId())}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.todoIds) ? (data.todoIds as string[]) : [];
  } catch {
    return [];
  }
}

export function calendarFeedUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/api/calendar/ics?sessionId=${encodeURIComponent(getSessionId())}`;
}
