"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Flame, Target, Timer, TrendingUp } from "lucide-react";
import { addDays, eachDayOfInterval, format, startOfYear, subDays } from "date-fns";
import { useStore, useStreak } from "@/lib/store";
import { toDateKey } from "@/lib/utils";
import { MOOD_EMOJI } from "@/lib/types";

function YearHeatmap() {
  const todos = useStore((s) => s.todos);
  const data = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of todos) {
      if (!t.done) continue;
      m.set(t.date, (m.get(t.date) ?? 0) + 1);
    }
    return m;
  }, [todos]);

  const end = new Date();
  const start = subDays(end, 365);
  const days = eachDayOfInterval({ start, end });

  function color(n: number) {
    if (n === 0) return "var(--surface-2)";
    if (n < 2) return "color-mix(in oklab, var(--accent) 25%, transparent)";
    if (n < 4) return "color-mix(in oklab, var(--accent) 55%, transparent)";
    if (n < 7) return "color-mix(in oklab, var(--accent) 80%, transparent)";
    return "var(--accent)";
  }

  const weeks: Date[][] = [];
  let cur: Date[] = [];
  for (const d of days) {
    if (cur.length === 0 && d.getDay() !== 0) {
      for (let i = 0; i < d.getDay(); i++) cur.push(addDays(d, -d.getDay() + i));
    }
    cur.push(d);
    if (d.getDay() === 6) {
      weeks.push(cur);
      cur = [];
    }
  }
  if (cur.length) weeks.push(cur);

  return (
    <div className="overflow-x-auto scroll-hidden">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const d = w[di];
              if (!d || d > end || d < start) {
                return <div key={di} className="w-2.5 h-2.5 rounded-sm opacity-0" />;
              }
              const key = toDateKey(d);
              const count = data.get(key) ?? 0;
              return (
                <div
                  key={di}
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: color(count) }}
                  title={`${key}: ${count} done`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <Icon size={14} />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </motion.div>
  );
}

export function StatsView() {
  const todos = useStore((s) => s.todos);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const habitChecks = useStore((s) => s.habitChecks);
  const moods = useStore((s) => s.moods);
  const focus = useStore((s) => s.focus);
  const streak = useStreak();

  const totalDone = todos.filter((t) => t.done).length;
  const avgCompletion = useMemo(() => {
    const byDate = new Map<string, { d: number; t: number }>();
    for (const t of todos) {
      const e = byDate.get(t.date) ?? { d: 0, t: 0 };
      e.t++;
      if (t.done) e.d++;
      byDate.set(t.date, e);
    }
    if (byDate.size === 0) return 0;
    let total = 0;
    for (const v of byDate.values()) total += v.d / v.t;
    return Math.round((total / byDate.size) * 100);
  }, [todos]);

  const bestDayOfWeek = useMemo(() => {
    const buckets: { d: number; t: number }[] = Array.from(
      { length: 7 },
      () => ({ d: 0, t: 0 })
    );
    for (const t of todos) {
      const dow = new Date(t.date).getDay();
      buckets[dow].t++;
      if (t.done) buckets[dow].d++;
    }
    const ratios = buckets.map((b) => (b.t > 0 ? b.d / b.t : -1));
    const best = ratios.indexOf(Math.max(...ratios));
    if (ratios[best] < 0) return "—";
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][best];
  }, [todos]);

  const totalFocusMinutes = focus.reduce((acc, f) => acc + f.durationMinutes, 0);
  const avgMood = useMemo(() => {
    if (moods.length === 0) return 0;
    return moods.reduce((a, m) => a + m.score, 0) / moods.length;
  }, [moods]);

  const moodDays = useMemo(() => {
    return [...moods]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14)
      .reverse();
  }, [moods]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight">Your stats</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Current streak"
            value={streak}
            icon={Flame}
            hint="days with at least one done"
          />
          <StatCard
            label="Tasks completed"
            value={totalDone}
            icon={TrendingUp}
            hint="lifetime"
          />
          <StatCard
            label="Avg daily completion"
            value={`${avgCompletion}%`}
            icon={Target}
            hint={`Best on ${bestDayOfWeek}`}
          />
          <StatCard
            label="Focus time"
            value={`${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`}
            icon={Timer}
            hint={`${focus.length} sessions`}
          />
        </div>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-4">
            Year in pixels — task completion
          </h2>
          <YearHeatmap />
          <div className="flex items-center gap-2 mt-4 text-xs text-[var(--muted)]">
            <span>less</span>
            {[0, 1, 3, 5, 8].map((n) => (
              <div
                key={n}
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  background:
                    n === 0
                      ? "var(--surface-2)"
                      : n < 2
                        ? "color-mix(in oklab, var(--accent) 25%, transparent)"
                        : n < 4
                          ? "color-mix(in oklab, var(--accent) 55%, transparent)"
                          : n < 7
                            ? "color-mix(in oklab, var(--accent) 80%, transparent)"
                            : "var(--accent)",
                }}
              />
            ))}
            <span>more</span>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-4">
              Goal progress
            </h2>
            {goals.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No goals tracked yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {goals.map((g) => {
                  const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: g.color }}
                          />
                          {g.title}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {g.current}/{g.target}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, pct)}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full rounded-full"
                          style={{ background: g.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-4">
              Habit streaks
            </h2>
            {habits.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No habits yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {habits.map((h) => {
                  const dates = new Set(
                    habitChecks.filter((c) => c.habitId === h.id).map((c) => c.date)
                  );
                  let s = 0;
                  const d = new Date();
                  while (dates.has(toDateKey(d))) {
                    s++;
                    d.setDate(d.getDate() - 1);
                  }
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-2)]"
                    >
                      <span className="text-lg">{h.emoji}</span>
                      <span className="text-sm flex-1 truncate">{h.title}</span>
                      <span className="text-xs flex items-center gap-1">
                        <Flame size={11} className="text-orange-400" />
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-4">
            Mood — last 14 entries
          </h2>
          {moodDays.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No moods logged yet.</p>
          ) : (
            <>
              <p className="text-2xl mb-2">
                {avgMood ? MOOD_EMOJI[Math.round(avgMood) as 1 | 2 | 3 | 4 | 5] : "—"}{" "}
                <span className="text-sm text-[var(--muted)]">
                  avg {avgMood ? avgMood.toFixed(1) : "—"}
                </span>
              </p>
              <div className="flex items-end gap-1 h-24">
                {moodDays.map((m) => (
                  <div
                    key={m.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-[var(--accent)] to-[var(--accent-2)]"
                      style={{ height: `${(m.score / 5) * 100}%` }}
                      title={`${m.date} ${MOOD_EMOJI[m.score]}`}
                    />
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {format(new Date(m.date), "d")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
