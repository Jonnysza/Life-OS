"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCheck,
  CheckCircle2,
  Circle,
  Filter,
  Flame,
  ListChecks,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useEventsFor, useStore, useTodosFor } from "@/lib/store";
import { GOAL_COLORS } from "@/lib/types";
import type { Habit } from "@/lib/types";
import { fromDateKey, toDateKey } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { soundCheck } from "@/lib/sound";

const EMOJI_OPTIONS = [
  "\u{1F4AA}",
  "\u{1F4DA}",
  "\u{1F9D8}",
  "\u{1F4A7}",
  "\u{1F3C3}",
  "\u{1F3AF}",
  "\u{270D}\u{FE0F}",
  "\u{1F34E}",
  "\u{1F634}",
  "\u{1F9E0}",
  "\u{1F3A8}",
  "\u{1F3B5}",
];

type HabitFilter = "needed" | "all" | "done";

function recentDates(endDate: string, count: number) {
  const end = fromDateKey(endDate);
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (count - 1 - idx));
    return toDateKey(d);
  });
}

function streakFor(habitId: string, checkedDates: Set<string>, endDate: string) {
  let streak = 0;
  const d = fromDateKey(endDate);
  while (checkedDates.has(`${habitId}:${toDateKey(d)}`)) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function HabitRow({
  habit,
  checked,
  streak,
  recent,
  onToggle,
  onDelete,
}: {
  habit: Habit;
  checked: boolean;
  streak: number;
  recent: { date: string; done: boolean }[];
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 items-center rounded-lg border px-2 py-2 transition ${
        checked
          ? "border-[var(--success)]/25 bg-[var(--success)]/10"
          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--muted)]"
      }`}
    >
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onToggle}
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={checked ? { color: habit.color } : undefined}
        title={checked ? "Mark incomplete" : "Mark complete"}
      >
        {checked ? <CheckCircle2 size={19} /> : <Circle size={19} />}
      </motion.button>

      <button
        onClick={onToggle}
        className="min-w-0 text-left grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 items-center"
      >
        <span className="text-lg leading-none">{habit.emoji}</span>
        <span
          className={`text-sm font-medium truncate ${
            checked ? "text-[var(--foreground)]" : ""
          }`}
        >
          {habit.title}
        </span>
        <span className="col-start-2 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <Flame
            size={11}
            className={streak > 0 ? "text-orange-400" : "text-[var(--muted)]"}
          />
          {streak} day streak
        </span>
      </button>

      <div className="flex items-center gap-2">
        <div className="hidden sm:grid grid-cols-7 gap-0.5 w-20">
          {recent.map((d) => (
            <span
              key={d.date}
              className="h-2 rounded-[2px]"
              style={{
                background: d.done ? habit.color : "var(--surface)",
                opacity: d.done ? 1 : 0.45,
              }}
              title={d.date}
            />
          ))}
        </div>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition"
          title="Delete habit"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

export function HabitsPanel() {
  const habits = useStore(useShallow((s) => s.habits.filter((h) => !h.archived)));
  const selectedDate = useStore((s) => s.selectedDate);
  const addHabit = useStore((s) => s.addHabit);
  const toggleHabit = useStore((s) => s.toggleHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const habitChecks = useStore((s) => s.habitChecks);
  const soundEnabled = useStore((s) => s.settings.soundEnabled);
  const todos = useTodosFor(selectedDate);
  const events = useEventsFor(selectedDate);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [color, setColor] = useState(GOAL_COLORS[6]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HabitFilter>("needed");

  const checkKeys = useMemo(
    () => new Set(habitChecks.map((c) => `${c.habitId}:${c.date}`)),
    [habitChecks]
  );
  const doneIds = useMemo(
    () =>
      new Set(
        habitChecks
          .filter((c) => c.date === selectedDate)
          .map((c) => c.habitId)
      ),
    [habitChecks, selectedDate]
  );
  const recent = useMemo(() => recentDates(selectedDate, 7), [selectedDate]);

  const enriched = useMemo(() => {
    const text = query.trim().toLowerCase();
    return habits
      .map((habit) => {
        const checked = doneIds.has(habit.id);
        return {
          habit,
          checked,
          streak: streakFor(habit.id, checkKeys, selectedDate),
          recent: recent.map((date) => ({
            date,
            done: checkKeys.has(`${habit.id}:${date}`),
          })),
        };
      })
      .filter((item) => {
        if (text && !item.habit.title.toLowerCase().includes(text)) return false;
        if (filter === "needed") return !item.checked;
        if (filter === "done") return item.checked;
        return true;
      })
      .sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return a.habit.title.localeCompare(b.habit.title);
      });
  }, [checkKeys, doneIds, filter, habits, query, recent, selectedDate]);

  const done = habits.filter((habit) => doneIds.has(habit.id)).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const taskDone = todos.filter((t) => t.done).length;
  const timedCount =
    todos.filter((t) => t.time).length + events.filter((e) => e.time).length;

  function submit() {
    if (!title.trim()) return;
    addHabit({ title: title.trim(), emoji, color });
    setTitle("");
    setAdding(false);
  }

  function onToggle(id: string, habitColor: string) {
    const wasChecked = doneIds.has(id);
    toggleHabit(id, selectedDate);
    if (!wasChecked) {
      if (soundEnabled) soundCheck();
      celebrate(habitColor);
    }
  }

  function completeVisible() {
    const toComplete = enriched.filter((item) => !item.checked);
    for (const item of toComplete) toggleHabit(item.habit.id, selectedDate);
    if (toComplete.length > 0 && soundEnabled) soundCheck();
  }

  function clearVisible() {
    for (const item of enriched.filter((x) => x.checked)) {
      toggleHabit(item.habit.id, selectedDate);
    }
  }

  return (
    <section className="glass rounded-2xl p-4 flex flex-col gap-3 min-h-[420px]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
            <Repeat size={14} />
            Habit dashboard
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            {done}/{total} complete today
            {total > 0 ? ` - ${pct}%` : ""} - {taskDone}/{todos.length} tasks -{" "}
            {timedCount} timed blocks
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {total > 0 && (
            <div className="w-40 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden border border-[var(--border)]">
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                className="h-full bg-[var(--success)]"
              />
            </div>
          )}
          <button
            onClick={completeVisible}
            disabled={enriched.every((item) => item.checked)}
            className="px-2.5 py-1.5 rounded-md bg-[var(--surface-2)] hover:bg-[var(--border)] disabled:opacity-40 text-xs flex items-center gap-1.5"
          >
            <CheckCheck size={13} />
            Complete visible
          </button>
          <button
            onClick={clearVisible}
            disabled={enriched.every((item) => !item.checked)}
            className="px-2.5 py-1.5 rounded-md bg-[var(--surface-2)] hover:bg-[var(--border)] disabled:opacity-40 text-xs flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            Clear visible
          </button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setAdding(!adding)}
            className="w-8 h-8 rounded-md bg-[var(--accent)] text-white flex items-center justify-center"
            title={adding ? "Close" : "Add habit"}
          >
            {adding ? <X size={14} /> : <Plus size={14} />}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 overflow-hidden"
          >
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Add a habit - e.g. Drink 2L of water"
                className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
              />
              <button
                onClick={submit}
                className="px-3 py-2 rounded-md bg-[var(--accent)] text-white text-sm"
              >
                Add habit
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {EMOJI_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setEmoji(item)}
                  className={`w-8 h-8 rounded-md text-base transition ${
                    emoji === item
                      ? "bg-[var(--accent)]/25 ring-1 ring-[var(--accent)]"
                      : "bg-[var(--surface)] hover:bg-[var(--border)]"
                  }`}
                >
                  {item}
                </button>
              ))}
              <span className="w-px h-6 bg-[var(--border)] mx-1" />
              {GOAL_COLORS.map((item) => (
                <button
                  key={item}
                  onClick={() => setColor(item)}
                  className="w-6 h-6 rounded-md"
                  style={{
                    background: item,
                    outline: color === item ? `2px solid ${item}` : "none",
                    outlineOffset: 2,
                  }}
                  title={item}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-2 lg:grid-cols-[minmax(220px,0.7fr)_auto]">
        <label className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2">
          <Search size={14} className="text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search habits"
            className="bg-transparent text-sm min-w-0 flex-1 placeholder:text-[var(--muted)]"
          />
        </label>
        <div className="flex p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] overflow-x-auto scroll-hidden">
          {[
            ["needed", "Needed"],
            ["all", "All"],
            ["done", "Done"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as HabitFilter)}
              className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 whitespace-nowrap transition ${
                filter === value
                  ? "bg-[var(--surface)] text-[var(--foreground)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {value === "needed" ? <Filter size={12} /> : <ListChecks size={12} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 && !adding ? (
        <div className="flex-1 min-h-[220px] rounded-xl border border-dashed border-[var(--border)] flex flex-col items-center justify-center text-center p-6">
          <Repeat size={26} className="text-[var(--muted)] mb-2" />
          <p className="text-sm font-medium">No habits yet</p>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-sm">
            Add the daily actions you want to track, then this becomes your fast
            command board for checking them off.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 px-3 py-2 rounded-md bg-[var(--accent)] text-white text-sm"
          >
            Add first habit
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 max-h-[620px] overflow-y-auto scroll-hidden pr-1">
          <AnimatePresence initial={false}>
            {enriched.map((item) => (
              <HabitRow
                key={item.habit.id}
                habit={item.habit}
                checked={item.checked}
                streak={item.streak}
                recent={item.recent}
                onToggle={() => onToggle(item.habit.id, item.habit.color)}
                onDelete={() => deleteHabit(item.habit.id)}
              />
            ))}
          </AnimatePresence>
          {enriched.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4 py-10 text-center text-sm text-[var(--muted)]">
              Nothing matches this view.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
