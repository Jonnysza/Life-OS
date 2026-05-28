"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { fromDateKey, toDateKey } from "@/lib/utils";

export function WeekStrip() {
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const todos = useStore((s) => s.todos);
  const events = useStore((s) => s.events);
  const [cursor, setCursor] = useState(() => fromDateKey(selectedDate));

  const days = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const activity = useMemo(() => {
    const map = new Map<string, { total: number; done: number; events: number }>();
    for (const t of todos) {
      const entry = map.get(t.date) ?? { total: 0, done: 0, events: 0 };
      entry.total++;
      if (t.done) entry.done++;
      map.set(t.date, entry);
    }
    for (const e of events) {
      const entry = map.get(e.date) ?? { total: 0, done: 0, events: 0 };
      entry.events++;
      map.set(e.date, entry);
    }
    return map;
  }, [todos, events]);

  return (
    <section className="glass rounded-2xl p-2 flex items-center gap-2">
      <button
        onClick={() => setCursor(subWeeks(cursor, 1))}
        className="w-8 h-8 rounded-xl hover:bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 transition"
        title="Previous week"
      >
        <ChevronLeft size={15} />
      </button>

      <div className="flex-1 grid grid-cols-7 gap-1.5 min-w-0">
        {days.map((day) => {
          const key = toDateKey(day);
          const selected = key === selectedDate;
          const today = isToday(day);
          const a = activity.get(key);
          const pct = a && a.total > 0 ? a.done / a.total : 0;

          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedDate(key);
                if (!isSameDay(day, cursor)) setCursor(day);
              }}
              className={`relative h-14 rounded-xl px-2 flex flex-col items-center justify-center border transition min-w-0 ${
                selected
                  ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] border-transparent text-white"
                  : "bg-[var(--surface-2)]/45 border-[var(--border)] hover:border-[var(--muted)]"
              }`}
            >
              <span
                className={`text-[9px] uppercase tracking-wider ${
                  selected ? "text-white/75" : "text-[var(--muted)]"
                }`}
              >
                {format(day, "EEE")}
              </span>
              <span className="text-base font-semibold leading-tight">
                {format(day, "d")}
              </span>
              {today && !selected && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              )}
              {(a?.total || a?.events) ? (
                <span className="absolute bottom-1.5 left-2 right-2 h-1 rounded-full bg-black/20 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${
                      selected
                        ? "bg-white"
                        : pct === 1
                          ? "bg-[var(--success)]"
                          : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${Math.max(a?.events ? 12 : 0, pct * 100)}%` }}
                  />
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      <button
        onClick={() => setCursor(addWeeks(cursor, 1))}
        className="w-8 h-8 rounded-xl hover:bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 transition"
        title="Next week"
      >
        <ChevronRight size={15} />
      </button>
    </section>
  );
}
