"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Command,
  Target,
  ListChecks,
  CalendarPlus,
  NotebookPen,
  Search,
  Repeat,
  ChevronRight,
} from "lucide-react";
import { addDays } from "date-fns";
import { useStore } from "@/lib/store";
import { toDateKey } from "@/lib/utils";

type Mode = "menu" | "goal" | "todo" | "event" | "habit";

function smartParseDate(text: string): { cleaned: string; date?: string } {
  const lower = text.toLowerCase();
  const today = new Date();
  const patterns: { re: RegExp; offset: (m: RegExpMatchArray) => Date | null }[] = [
    { re: /\btoday\b/, offset: () => today },
    { re: /\btmrw\b|\btomorrow\b/, offset: () => addDays(today, 1) },
    { re: /\byesterday\b/, offset: () => addDays(today, -1) },
    {
      re: /\bnext (mon|tue|wed|thu|fri|sat|sun)\b/,
      offset: (m) => {
        const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const target = days.indexOf(m[1]);
        const cur = today.getDay();
        const diff = ((target - cur + 7) % 7) || 7;
        return addDays(today, diff);
      },
    },
    {
      re: /\b(mon|tue|wed|thu|fri|sat|sun)\b/,
      offset: (m) => {
        const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const target = days.indexOf(m[1]);
        const cur = today.getDay();
        const diff = ((target - cur + 7) % 7) || 7;
        return addDays(today, diff);
      },
    },
    {
      re: /\bin (\d+) (day|days)\b/,
      offset: (m) => addDays(today, Number(m[1])),
    },
  ];
  for (const { re, offset } of patterns) {
    const m = lower.match(re);
    if (m) {
      const d = offset(m);
      if (d) {
        return { cleaned: text.replace(re, "").trim(), date: toDateKey(d) };
      }
    }
  }
  return { cleaned: text };
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [text, setText] = useState("");
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const addGoal = useStore((s) => s.addGoal);
  const addTodo = useStore((s) => s.addTodo);
  const addEvent = useStore((s) => s.addEvent);
  const addHabit = useStore((s) => s.addHabit);
  const goals = useStore((s) => s.goals);
  const todos = useStore((s) => s.todos);
  const notes = useStore((s) => s.notes);
  const events = useStore((s) => s.events);
  const habits = useStore((s) => s.habits);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setText("");
    }
  }, [open]);

  const results = useMemo(() => {
    if (mode !== "menu" || !text.trim()) return null;
    const q = text.toLowerCase();
    const r: { kind: string; title: string; sub?: string; date?: string }[] = [];
    for (const g of goals) {
      if (g.title.toLowerCase().includes(q))
        r.push({ kind: "goal", title: g.title, sub: `Goal · ${g.current}/${g.target} ${g.unit}` });
    }
    for (const t of todos.slice(-50)) {
      if (t.title.toLowerCase().includes(q))
        r.push({
          kind: "todo",
          title: t.title,
          sub: `Todo · ${t.date}`,
          date: t.date,
        });
    }
    for (const e of events.slice(-50)) {
      if (e.title.toLowerCase().includes(q))
        r.push({
          kind: "event",
          title: e.title,
          sub: `Event · ${e.date}${e.time ? " · " + e.time : ""}`,
          date: e.date,
        });
    }
    for (const n of notes) {
      if (n.content.toLowerCase().includes(q))
        r.push({
          kind: "note",
          title: n.content.slice(0, 60),
          sub: `Note · ${n.date}`,
          date: n.date,
        });
    }
    for (const h of habits) {
      if (h.title.toLowerCase().includes(q))
        r.push({ kind: "habit", title: `${h.emoji} ${h.title}`, sub: "Habit" });
    }
    return r.slice(0, 10);
  }, [text, mode, goals, todos, events, notes, habits]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (mode === "goal") addGoal({ title: trimmed });
    if (mode === "todo") {
      const { cleaned, date } = smartParseDate(trimmed);
      addTodo({ title: cleaned || trimmed, date: date ?? selectedDate });
    }
    if (mode === "event") {
      const { cleaned, date } = smartParseDate(trimmed);
      addEvent({ title: cleaned || trimmed, date: date ?? selectedDate });
    }
    if (mode === "habit") addHabit({ title: trimmed, emoji: "✨" });
    setOpen(false);
  }

  const items = [
    { mode: "goal" as const, icon: Target, label: "New goal" },
    { mode: "todo" as const, icon: ListChecks, label: "New todo", hint: "tomorrow, next mon…" },
    { mode: "event" as const, icon: CalendarPlus, label: "New event" },
    { mode: "habit" as const, icon: Repeat, label: "New habit" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition"
      >
        <Command size={12} />
        <span>Search · add</span>
        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
            >
              <div className="p-2 border-b border-[var(--border)] flex items-center gap-2 px-3">
                <Search size={14} className="text-[var(--muted)]" />
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && mode !== "menu" && submit()}
                  placeholder={
                    mode === "menu"
                      ? "Search anything, or type to add…"
                      : `Title for new ${mode}…`
                  }
                  className="flex-1 py-2.5 bg-transparent text-sm placeholder:text-[var(--muted)]"
                />
                {mode !== "menu" && (
                  <button
                    onClick={() => setMode("menu")}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    back
                  </button>
                )}
              </div>

              <div className="p-2 max-h-[60vh] overflow-y-auto">
                {mode === "menu" && results && results.length > 0 ? (
                  <>
                    <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Found
                    </p>
                    {results.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (r.date) setSelectedDate(r.date);
                          setOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left"
                      >
                        <div className="w-7 h-7 rounded-md bg-[var(--surface-2)] flex items-center justify-center text-xs uppercase text-[var(--muted)]">
                          {r.kind[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{r.title}</p>
                          <p className="text-xs text-[var(--muted)] truncate">{r.sub}</p>
                        </div>
                        <ChevronRight size={12} className="text-[var(--muted)]" />
                      </button>
                    ))}
                    <div className="my-2 h-px bg-[var(--border)]" />
                  </>
                ) : null}

                {mode === "menu" && (
                  <>
                    <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Add new
                    </p>
                    {items.map((it) => (
                      <button
                        key={it.mode}
                        onClick={() => setMode(it.mode)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-2)] text-left"
                      >
                        <div className="w-7 h-7 rounded-md bg-[var(--surface-2)] flex items-center justify-center">
                          <it.icon size={13} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{it.label}</p>
                          {it.hint && (
                            <p className="text-xs text-[var(--muted)]">
                              try “{it.hint}”
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {mode !== "menu" && (
                  <div className="p-3 text-xs text-[var(--muted)]">
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded font-mono">
                      Enter
                    </kbd>{" "}
                    to add.
                    {(mode === "todo" || mode === "event") && (
                      <>
                        {" "}
                        Try{" "}
                        <span className="italic text-[var(--foreground)]">
                          buy milk tomorrow
                        </span>
                        ,{" "}
                        <span className="italic text-[var(--foreground)]">
                          gym next mon
                        </span>
                        , or{" "}
                        <span className="italic text-[var(--foreground)]">
                          deadline in 3 days
                        </span>
                        .
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
