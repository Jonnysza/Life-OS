"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Bell, CalendarClock, CheckCircle2, Flame, Target } from "lucide-react";
import { format } from "date-fns";
import { useStore, useStreak, useTodosFor } from "@/lib/store";
import { toDateKey } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 5) return "Late shift";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Tonight";
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--border)] px-3 py-2 min-w-0">
      <div className="text-[var(--accent)] flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] leading-none">
          {label}
        </p>
        <p className="text-sm font-semibold truncate mt-1">{value}</p>
      </div>
    </div>
  );
}

export function Hero() {
  const [now, setNow] = useState<Date | null>(null);
  const todayKey = toDateKey(new Date());
  const todos = useTodosFor(todayKey);
  const goals = useStore((s) => s.goals);
  const streak = useStreak();

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const done = todos.filter((t) => t.done).length;
  const total = todos.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const armed = todos.filter((t) => t.time && !t.done).length;
  const blockedMinutes = todos.reduce(
    (sum, t) => sum + (t.time && !t.done ? (t.durationMinutes ?? 30) : 0),
    0
  );

  const nextUp = useMemo(() => {
    const pending = todos.filter((t) => !t.done);
    const timed = pending
      .filter((t) => t.time)
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    return timed[0] ?? pending[0];
  }, [todos]);

  const activeGoalCount = useMemo(
    () => goals.filter((g) => !g.archived).length,
    [goals]
  );

  function fmtDuration(minutes: number) {
    if (!minutes) return "0m";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  return (
    <section className="glass rounded-2xl p-4 sm:p-5 overflow-hidden">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-semibold">
                {now ? format(now, "EEEE, MMM d") : "Today"}
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">
                {now ? greeting(now.getHours()) : "Today"}
                <span className="text-[var(--muted)]"> command center</span>
              </h1>
            </div>
            <div className="hidden sm:block text-right flex-shrink-0">
              <p className="font-mono text-sm tabular-nums">
                {now ? format(now, "h:mm a") : "--:--"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                local time
              </p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat
              icon={<CheckCircle2 size={15} />}
              label="Done"
              value={`${done}/${total} (${pct}%)`}
            />
            <Stat
              icon={<Bell size={15} />}
              label="Armed"
              value={`${armed} reminder${armed === 1 ? "" : "s"}`}
            />
            <Stat
              icon={<CalendarClock size={15} />}
              label="Scheduled"
              value={fmtDuration(blockedMinutes)}
            />
            <Stat
              icon={streak > 0 ? <Flame size={15} /> : <Target size={15} />}
              label={streak > 0 ? "Streak" : "Goals"}
              value={
                streak > 0
                  ? `${streak} day${streak === 1 ? "" : "s"}`
                  : `${activeGoalCount} active`
              }
            />
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--surface-2)]/75 border border-[var(--border)] p-4 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
            Next up
          </p>
          {nextUp ? (
            <>
              <p className="text-base font-semibold mt-1 truncate">{nextUp.title}</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {nextUp.time
                  ? `${nextUp.time} · ${nextUp.durationMinutes ?? 30} min`
                  : "No reminder yet. Add a time to make it chase you."}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold mt-1">No task loaded</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Add one task below, set a time, and Life OS will arm it.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
