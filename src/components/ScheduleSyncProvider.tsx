"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  syncScheduleToServer,
  pollCompletedFromServer,
} from "@/lib/push/client";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const now = Date.now();
      const horizon = now + 7 * 24 * 60 * 60 * 1000;
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
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [todos, events]);

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
