"use client";

import { getSessionId } from "@/lib/session";

const STORE_KEY = "life-os-store";

export type Me = {
  configured: boolean;
  loggedIn: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export function loginUrl(): string {
  const params = new URLSearchParams({
    sessionId: getSessionId(),
    returnTo:
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/",
  });
  return `/api/auth/google?${params}`;
}

export async function fetchMe(): Promise<Me> {
  const res = await fetch(
    `/api/auth/me?sessionId=${encodeURIComponent(getSessionId())}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return {
      configured: false,
      loggedIn: false,
      email: null,
      name: null,
      picture: null,
    };
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId() }),
  });
}

export function readLocalBlob(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORE_KEY);
}

export function writeLocalBlob(blob: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, blob);
}

export async function pull(): Promise<{
  hasState: boolean;
  blob?: string;
  updatedAt?: number;
}> {
  const res = await fetch(
    `/api/sync?sessionId=${encodeURIComponent(getSessionId())}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { hasState: false };
  return res.json();
}

export async function push(
  blob: string,
  updatedAt: number
): Promise<{ ok: boolean; conflict?: boolean; updatedAt?: number }> {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: getSessionId(),
      blob,
      updatedAt,
      device:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 60)
          : undefined,
    }),
  });
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, conflict: true, updatedAt: data.updatedAt };
  }
  if (!res.ok) return { ok: false };
  const data = await res.json();
  return { ok: true, updatedAt: data.updatedAt };
}
