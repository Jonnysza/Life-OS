"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  syncScheduleToServer,
  pollCompletedFromServer,
} from "@/lib/push/client";
import { googleCalendarStatus, syncGoogleCalendar } from "@/lib/google/client";
import { fromDateKey } from "@/lib/utils";

function scheduledFor(date: string, time: string): number {
  const d = fromDateKey(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function ScheduleSyncProvider() {
  const todos = useStore((s) => s.todos);
  const events = useStore((s) => s.events);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const materializeRoutineTemplates = useStore((s) => s.materializeRoutineTemplates);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleConnectedRef = useRef(false);

  useEffect(() => {
    googleCalendarStatus()
      .then((status) => {
        googleConnectedRef.current =
          status.configured && status.redis && status.connected && !status.needsReconnect;
      })
      .catch(() => {
        googleConnectedRef.current = false;
      });
  }, []);

  useEffect(() => {
    materializeRoutineTemplates(7);
    const i = setInterval(() => materializeRoutineTemplates(7), 60 * 60 * 1000);
    return () => clearInterval(i);
  }, [materializeRoutineTemplates]);

  useEffect(() => {
    function sync() {
      const now = Date.now();
      const horizon = now + 14 * 24 * 60 * 60 * 1000;
      const blocks: Parameters<typeof syncScheduleToServer>[0] = [];
      for (const t of todos) {
        if (!t.time || t.done) continue;
        const at = scheduledFor(t.date, t.time);
        if (at <= now || at > horizon) continue;
        blocks.push({
          todoId: t.id,
          title: t.title,
          date: t.date,
          time: t.time,
          durationMinutes: t.durationMinutes,
          kind: "todo",
          scheduledFor: at,
        });
      }
      for (const e of events) {
        if (e.source === "google") continue;
        if (!e.time) continue;
        const at = scheduledFor(e.date, e.time);
        if (at <= now || at > horizon) continue;
        blocks.push({
          todoId: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          durationMinutes: e.durationMinutes,
          kind: "event",
          scheduledFor: at,
        });
      }
      syncScheduleToServer(blocks);
      if (googleConnectedRef.current) {
        syncGoogleCalendar(blocks).catch(() => {
          googleConnectedRef.current = false;
        });
      }
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(sync, 800);

    const force = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      sync();
    };
    window.addEventListener("life-os:force-schedule-sync", force);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.removeEventListener("life-os:force-schedule-sync", force);
    };
  }, [todos, events]);

  useEffect(() => {
    async function kickCron() {
      try {
        await fetch("/api/cron/notify", { cache: "no-store" });
      } catch {
        // External/GitHub cron handles reminders when the app is closed.
      }
    }
    kickCron();
    const i = setInterval(kickCron, 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const ids = await pollCompletedFromServer();
      if (cancelled || ids.length === 0) return;
      const state = useStore.getState();
      for (const id of ids) {
        const t = state.todos.find((t) => t.id === id);
        if (t && !t.done) toggleTodo(id);
      }
    }
    tick();
    const i = setInterval(tick, 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [toggleTodo]);

  return null;
}
