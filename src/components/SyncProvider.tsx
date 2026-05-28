"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  fetchMe,
  pull,
  push,
  readLocalBlob,
  writeLocalBlob,
} from "@/lib/sync/client";

/**
 * Cross-device sync. When the user is signed in with Google, the entire
 * persisted store is mirrored to Redis keyed by their Google account.
 * - On load: pull server state; if newer, apply it.
 * - On change: debounced push.
 * - On focus / interval: pull; if server is newer, apply.
 * Last-write-wins by updatedAt.
 */
export function SyncProvider() {
  const initialized = useRef(false);
  const loggedIn = useRef(false);
  const localUpdatedAt = useRef(0);
  const lastApplied = useRef(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyServerBlob(blob: string, updatedAt: number) {
    try {
      const parsed = JSON.parse(blob);
      const state = parsed?.state ?? parsed;
      if (state && typeof state === "object") {
        useStore.setState(state);
        writeLocalBlob(blob);
        lastApplied.current = updatedAt;
        localUpdatedAt.current = updatedAt;
      }
    } catch {
      // ignore malformed
    }
  }

  async function doPush() {
    if (!loggedIn.current) return;
    const blob = readLocalBlob();
    if (!blob) return;
    const at = localUpdatedAt.current || Date.now();
    const res = await push(blob, at);
    if (!res.ok && res.conflict && res.updatedAt) {
      const server = await pull();
      if (server.hasState && server.blob && server.updatedAt) {
        applyServerBlob(server.blob, server.updatedAt);
      }
    } else if (res.ok && res.updatedAt) {
      lastApplied.current = res.updatedAt;
    }
  }

  async function doPull() {
    if (!loggedIn.current) return;
    const server = await pull();
    if (
      server.hasState &&
      server.blob &&
      server.updatedAt &&
      server.updatedAt > localUpdatedAt.current
    ) {
      applyServerBlob(server.blob, server.updatedAt);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const me = await fetchMe();
      if (cancelled) return;
      loggedIn.current = me.loggedIn;
      if (!me.loggedIn) {
        initialized.current = true;
        return;
      }
      // First pull wins on a fresh device.
      const server = await pull();
      if (cancelled) return;
      if (server.hasState && server.blob && server.updatedAt) {
        applyServerBlob(server.blob, server.updatedAt);
      } else {
        // Nothing on server yet — seed it from this device.
        localUpdatedAt.current = Date.now();
        await doPush();
      }
      initialized.current = true;

      // Subscribe to store changes → debounced push.
      useStore.subscribe(() => {
        if (!initialized.current || !loggedIn.current) return;
        localUpdatedAt.current = Date.now();
        if (pushTimer.current) clearTimeout(pushTimer.current);
        pushTimer.current = setTimeout(doPush, 1500);
      });
    }

    init();

    const onFocus = () => {
      if (document.visibilityState === "visible") doPull();
    };
    document.addEventListener("visibilitychange", onFocus);
    const interval = setInterval(doPull, 30_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(interval);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
