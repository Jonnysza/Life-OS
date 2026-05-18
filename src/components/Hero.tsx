"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Flame, Quote } from "lucide-react";
import { format } from "date-fns";
import { useStreak, useTodosFor } from "@/lib/store";
import { quoteForToday } from "@/lib/quotes";
import { toDateKey } from "@/lib/utils";
function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Winding down";
}

export function Hero() {
  const [now, setNow] = useState<Date | null>(null);
  const todayKey = toDateKey(new Date());
  const todaysTodos = useTodosFor(todayKey);
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

  return (
    <section className="glass rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between overflow-hidden relative">
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[var(--accent)] opacity-10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-[var(--accent-2)] opacity-10 blur-3xl pointer-events-none" />

      <div className="flex-1 min-w-0 z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-1 flex-wrap"
        >
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {now ? greeting(now.getHours()) : "Hello"}
          </h1>
          {streak > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/30"
            >
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Flame size={14} className="text-orange-400" />
              </motion.span>
              <span className="text-xs font-semibold text-orange-300">{streak}</span>
            </motion.span>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-[var(--muted)] mb-4 text-sm sm:text-base"
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
          transition={{ delay: 0.35 }}
          className="flex items-start gap-2 max-w-xl"
        >
          <Quote size={14} className="text-[var(--muted)] mt-1 flex-shrink-0" />
          <p className="text-sm text-[var(--muted)] italic leading-relaxed">
            “{quote.text}”{" "}
            <span className="not-italic opacity-70">— {quote.author}</span>
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative flex-shrink-0 z-10"
      >
        <svg width="120" height="120" className="-rotate-90">
          <circle
            cx="60"
            cy="60"
            r="46"
            stroke="var(--surface-2)"
            strokeWidth="8"
            fill="none"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="46"
            stroke="url(#progressGrad)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            strokeDasharray={circumference}
          />
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{Math.round(pct * 100)}%</span>
          <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
            {done}/{total} today
          </span>
        </div>
      </motion.div>
    </section>
  );
}
