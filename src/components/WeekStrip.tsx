"use client";

import { useMemo } from "react";
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
import { useState } from "react";
import { useStore } from "@/lib/store";
import { toDateKey, fromDateKey } from "@/lib/utils";

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
    const m = new Map<string, { total: number; done: number; events: number }>();
    for (const t of todos) {
      const e = m.get(t.date) ?? { total: 0, done: 0, events: 0 };
      e.total++;
      if (t.done) e.done++;
      m.set(t.date, e);
    }
    for (const ev of events) {
      const e = m.get(ev.date) ?? { total: 0, done: 0, events: 0 };
      e.events++;
      m.set(ev.date, e);
    }
    return m;
  }, [todos, events]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setCursor(subWeeks(cursor, 1))}
        className="w-9 h-9 rounded-xl glass hover:bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 transition"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = toDateKey(d);
          const isSel = key === selectedDate;
          const isTod = isToday(d);
          const a = activity.get(key);
          const completion = a && a.total > 0 ? a.done / a.total : 0;
          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedDate(key);
                if (!isSameDay(d, cursor)) setCursor(d);
              }}
              className={`relative rounded-xl p-2.5 flex flex-col items-center transition border ${
                isSel
                  ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] border-transparent text-white shadow-lg shadow-[var(--accent)]/30"
                  : "glass border-[var(--border)] hover:border-[var(--muted)]"
              }`}
            >
              <span
                className={`text-[10px] uppercase tracking-wider font-medium ${
                  isSel ? "text-white/80" : "text-[var(--muted)]"
                }`}
              >
                {format(d, "EEE")}
              </span>
              <span className="text-lg font-semibold mt-0.5">
                {format(d, "d")}
              </span>

              {isTod && !isSel && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              )}

              <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden bg-black/20">
                {a && a.total > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completion * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full ${
                      isSel
                        ? "bg-white"
                        : completion === 1
                          ? "bg-[var(--success)]"
                          : "bg-[var(--accent)]"
                    }`}
                  />
                )}
              </div>

              {a?.events ? (
                <span
                  className={`absolute bottom-1 right-1.5 w-1 h-1 rounded-full ${
                    isSel ? "bg-white" : "bg-[var(--accent-2)]"
                  }`}
                />
              ) : null}
            </motion.button>
          );
        })}
      </div>

      <button
        onClick={() => setCursor(addWeeks(cursor, 1))}
        className="w-9 h-9 rounded-xl glass hover:bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 transition"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
