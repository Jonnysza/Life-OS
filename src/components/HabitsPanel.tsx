"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Check, Flame, Trash2, Repeat } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useStore, useHabitStreak } from "@/lib/store";
import { GOAL_COLORS } from "@/lib/types";
import { toDateKey } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { soundCheck } from "@/lib/sound";

const EMOJI_OPTIONS = ["💪", "📚", "🧘", "💧", "🏃", "🎯", "✍️", "🍎", "😴", "🧠", "🎨", "🎵"];

function HabitCard({
  habit,
  checkedToday,
  onToggle,
  onDelete,
}: {
  habit: { id: string; title: string; emoji: string; color: string };
  checkedToday: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const streak = useHabitStreak(habit.id);
  const checks = useStore(
    useShallow((s) =>
      s.habitChecks.filter((c) => c.habitId === habit.id).map((c) => c.date)
    )
  );
  const checkSet = new Set(checks);

  const last30: { date: string; done: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    last30.push({ date: key, done: checkSet.has(key) });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2 }}
      className="group relative flex-shrink-0 w-56 p-4 rounded-2xl border bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--muted)] transition overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: habit.color }}
      />
      <div className="flex items-start justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <span className="text-xl">{habit.emoji}</span>
          <h3 className="text-sm font-medium truncate max-w-[120px]">
            {habit.title}
          </h3>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-3 relative">
        <Flame
          size={12}
          className={streak > 0 ? "text-orange-400" : "text-[var(--muted)]"}
        />
        <span className="text-xs font-semibold">{streak}</span>
        <span className="text-xs text-[var(--muted)]">day streak</span>
      </div>

      <div className="grid grid-cols-[repeat(15,_minmax(0,_1fr))] gap-0.5 mb-3 relative">
        {last30.map((d) => (
          <div
            key={d.date}
            className="aspect-square rounded-sm"
            style={{
              background: d.done ? habit.color : "var(--surface)",
              opacity: d.done ? 1 : 0.4,
            }}
            title={d.date}
          />
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition ${
          checkedToday
            ? "text-white"
            : "bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)]"
        }`}
        style={checkedToday ? { background: habit.color } : undefined}
      >
        {checkedToday ? (
          <>
            <Check size={14} /> Done today
          </>
        ) : (
          "Mark complete"
        )}
      </motion.button>
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

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [color, setColor] = useState(GOAL_COLORS[6]);

  function submit() {
    if (!title.trim()) return;
    addHabit({ title: title.trim(), emoji, color });
    setTitle("");
    setAdding(false);
  }

  function onToggle(id: string, color: string) {
    const wasChecked = habitChecks.some(
      (c) => c.habitId === id && c.date === selectedDate
    );
    toggleHabit(id, selectedDate);
    if (!wasChecked) {
      if (soundEnabled) soundCheck();
      celebrate(color);
    }
  }

  if (habits.length === 0 && !adding) {
    return (
      <section className="glass rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Repeat size={18} className="text-[var(--muted)]" />
          <div>
            <h2 className="text-sm font-semibold">Daily habits</h2>
            <p className="text-xs text-[var(--muted)]">
              Build a streak — drink water, read, meditate, anything.
            </p>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] text-xs font-medium transition flex items-center gap-1.5"
        >
          <Plus size={12} /> Add habit
        </button>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
          <Repeat size={14} />
          Habits
        </h2>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setAdding(!adding)}
          className="w-7 h-7 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] flex items-center justify-center"
        >
          {adding ? <X size={14} /> : <Plus size={14} />}
        </motion.button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2 overflow-hidden"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Habit — e.g. Drink 2L of water"
              className="bg-transparent text-sm"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-7 h-7 rounded-md text-base transition ${
                    emoji === e ? "bg-[var(--accent)]/30" : "hover:bg-[var(--surface)]"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full"
                  style={{
                    background: c,
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={submit}
                className="ml-auto px-3 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-medium"
              >
                Add habit
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 overflow-x-auto scroll-hidden pb-2 -mx-2 px-2">
        <AnimatePresence>
          {habits.map((h) => {
            const checked = habitChecks.some(
              (c) => c.habitId === h.id && c.date === selectedDate
            );
            return (
              <HabitCard
                key={h.id}
                habit={h}
                checkedToday={checked}
                onToggle={() => onToggle(h.id, h.color)}
                onDelete={() => deleteHabit(h.id)}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
