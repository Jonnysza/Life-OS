"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Flame, Quote, Clock, Target, TrendingUp, TrendingDown } from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useStore, useStreak, useTodosFor } from "@/lib/store";
import { quoteForToday } from "@/lib/quotes";
import { toDateKey } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Winding down";
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const dur = 600;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{display}</span>;
}

export function Hero() {
  const [now, setNow] = useState<Date | null>(null);
  const todayKey = toDateKey(new Date());
  const todaysTodos = useTodosFor(todayKey);
  const goals = useStore((s) => s.goals);
  const streak = useStreak();
  const quote = quoteForToday();

  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const done = todaysTodos.filter((t) => t.done).length;
  const total = todaysTodos.length;
  const pct = total > 0 ? done / total : 0;
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - pct * circumference;

  const blockedMinutes = useMemo(() => {
    return todaysTodos.reduce(
      (acc, t) => acc + (t.time ? (t.durationMinutes ?? 30) : 0),
      0
    );
  }, [todaysTodos]);

  const remainingMinutes = useMemo(() => {
    return todaysTodos.reduce(
      (acc, t) => acc + (t.time && !t.done ? (t.durationMinutes ?? 30) : 0),
      0
    );
  }, [todaysTodos]);

  const goalInsights = useMemo(() => {
    const today = new Date();
    let onPace = 0;
    let behind = 0;
    let ahead = 0;
    for (const g of goals) {
      if (g.archived || !g.dueDate) continue;
      const created = parseISO(g.createdAt);
      const due = parseISO(g.dueDate);
      const total = Math.max(1, differenceInCalendarDays(due, created));
      const elapsed = Math.max(0, differenceInCalendarDays(today, created));
      const expected = Math.min(1, elapsed / total) * g.target;
      if (g.current >= expected * 1.1) ahead++;
      else if (g.current < expected * 0.85) behind++;
      else onPace++;
    }
    return { onPace, behind, ahead, total: ahead + behind + onPace };
  }, [goals]);

  const dayOfYear = now
    ? Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
      )
    : 0;

  function fmtDuration(m: number) {
    if (m === 0) return "0m";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  return (
    <section className="glass rounded-3xl p-6 sm:p-8 overflow-hidden relative">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--accent)] opacity-15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-24 w-72 h-72 rounded-full bg-[var(--accent-2)] opacity-12 blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-1/3 w-48 h-48 rounded-full bg-pink-500 opacity-5 blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_auto] gap-8 items-center relative z-10">
        <div className="min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3 mb-2 flex-wrap"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-semibold">
              Day {dayOfYear} of {now ? (now.getFullYear() % 4 === 0 ? 366 : 365) : 365}
            </p>
            {streak > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30"
              >
                <motion.span
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Flame size={11} className="text-orange-400" />
                </motion.span>
                <AnimatedNumber
                  value={streak}
                  className="text-[10px] font-bold text-orange-300"
                />
                <span className="text-[10px] text-orange-300/70">day streak</span>
              </motion.span>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05] mb-2"
          >
            {now ? greeting(now.getHours()) : "Hello"}
            <span className="text-[var(--muted)]">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-[var(--muted)] text-sm sm:text-base mb-5"
          >
            {now ? format(now, "EEEE, MMMM d") : "—"}
            <span className="mx-2 opacity-50">·</span>
            <span className="font-mono tabular-nums">
              {now ? format(now, "h:mm:ss a") : "—"}
            </span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-3 gap-3 mb-5"
          >
            <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 backdrop-blur border border-[var(--border)]">
              <div className="flex items-center gap-1.5 text-[var(--muted)] mb-1">
                <Clock size={11} />
                <span className="text-[10px] uppercase tracking-wider font-semibold">
                  Today
                </span>
              </div>
              <p className="text-lg font-semibold tracking-tight">
                {fmtDuration(remainingMinutes)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                {blockedMinutes > 0 ? `of ${fmtDuration(blockedMinutes)} blocked` : "nothing scheduled"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 backdrop-blur border border-[var(--border)]">
              <div className="flex items-center gap-1.5 text-[var(--muted)] mb-1">
                <Target size={11} />
                <span className="text-[10px] uppercase tracking-wider font-semibold">
                  Goals
                </span>
              </div>
              <p className="text-lg font-semibold tracking-tight">
                <AnimatedNumber value={goalInsights.onPace + goalInsights.ahead} /> /{" "}
                {goalInsights.total || goals.length}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                {goalInsights.total > 0
                  ? `${goalInsights.behind} behind pace`
                  : goals.length === 0
                    ? "none yet"
                    : "no deadlines"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 backdrop-blur border border-[var(--border)]">
              <div className="flex items-center gap-1.5 text-[var(--muted)] mb-1">
                {pct >= 0.66 ? (
                  <TrendingUp size={11} className="text-[var(--success)]" />
                ) : pct >= 0.33 ? (
                  <TrendingUp size={11} />
                ) : (
                  <TrendingDown size={11} className="text-orange-400" />
                )}
                <span className="text-[10px] uppercase tracking-wider font-semibold">
                  Done
                </span>
              </div>
              <p className="text-lg font-semibold tracking-tight">
                <AnimatedNumber value={done} /> / {total}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                {total === 0 ? "no tasks yet" : `${Math.round(pct * 100)}% complete`}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-start gap-2 max-w-2xl border-l-2 border-[var(--accent)]/40 pl-3"
          >
            <Quote size={12} className="text-[var(--muted)] mt-1 flex-shrink-0" />
            <p className="text-sm text-[var(--muted)] italic leading-relaxed">
              “{quote.text}”{" "}
              <span className="not-italic opacity-60 text-xs">— {quote.author}</span>
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative flex-shrink-0 mx-auto"
        >
          <svg width="160" height="160" className="-rotate-90">
            <circle
              cx="80"
              cy="80"
              r="62"
              stroke="var(--surface-2)"
              strokeWidth="10"
              fill="none"
            />
            <motion.circle
              cx="80"
              cy="80"
              r="62"
              stroke="url(#progressGrad)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              initial={{ strokeDashoffset: 2 * Math.PI * 62 }}
              animate={{
                strokeDashoffset: (2 * Math.PI * 62) - pct * (2 * Math.PI * 62),
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeDasharray={2 * Math.PI * 62}
            />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tracking-tight">
              <AnimatedNumber value={Math.round(pct * 100)} />%
            </span>
            <span className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mt-0.5">
              Day progress
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
