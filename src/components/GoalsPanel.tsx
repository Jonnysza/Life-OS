"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Target, Minus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { GOAL_COLORS } from "@/lib/types";
import { shortDate } from "@/lib/utils";
import { celebrateBig } from "@/lib/celebrate";

export function GoalsPanel() {
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const incrementGoal = useStore((s) => s.incrementGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("100");
  const [unit, setUnit] = useState("%");
  const [dueDate, setDueDate] = useState("");
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const wasCompleted = useRef<Set<string>>(new Set());

  function submit() {
    if (!title.trim()) return;
    addGoal({
      title: title.trim(),
      target: Number(target) || 100,
      unit: unit || "%",
      dueDate: dueDate || undefined,
      color,
    });
    setTitle("");
    setTarget("100");
    setUnit("%");
    setDueDate("");
    setAdding(false);
  }

  function bump(id: string, by: number, color: string, current: number, targetN: number) {
    incrementGoal(id, by);
    const next = Math.max(0, Math.min(targetN, current + by));
    const wasFull = wasCompleted.current.has(id);
    if (next >= targetN && !wasFull) {
      celebrateBig(color);
      wasCompleted.current.add(id);
    } else if (next < targetN) {
      wasCompleted.current.delete(id);
    }
  }

  return (
    <section className="glass rounded-2xl p-5 flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
          <Target size={14} />
          Goals
        </h2>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setAdding(!adding)}
          className="w-7 h-7 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] flex items-center justify-center transition"
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
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Goal title — e.g. Run 100 miles"
              className="bg-transparent text-sm placeholder:text-[var(--muted)]"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-20 bg-[var(--surface)] text-sm px-2 py-1 rounded-md border border-[var(--border)]"
              />
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="unit"
                className="w-20 bg-[var(--surface)] text-sm px-2 py-1 rounded-md border border-[var(--border)]"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 bg-[var(--surface)] text-sm px-2 py-1 rounded-md border border-[var(--border)]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full transition"
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
                className="ml-auto px-3 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90"
              >
                Add
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 overflow-y-auto scroll-hidden -mr-2 pr-2 flex-1 min-h-0">
        {goals.length === 0 && !adding && (
          <div className="text-sm text-[var(--muted)] py-12 text-center flex flex-col items-center gap-3">
            <Target size={28} className="opacity-40" />
            <p>No goals yet.</p>
            <button
              onClick={() => setAdding(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] transition"
            >
              + Add your first goal
            </button>
          </div>
        )}
        <AnimatePresence initial={false}>
          {goals.map((g) => {
            const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
            const isDone = pct >= 100;
            return (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`group relative p-3 rounded-xl border transition-all overflow-hidden ${
                  isDone
                    ? "bg-[var(--surface-2)] border-[var(--success)]/50"
                    : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--muted)]"
                }`}
                whileHover={{ y: -2 }}
              >
                {isDone && (
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ background: g.color }}
                  />
                )}
                <div className="flex items-start justify-between mb-2 relative">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: g.color }}
                      />
                      <h3 className="text-sm font-medium truncate">{g.title}</h3>
                      {isDone && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-xs"
                          style={{ color: g.color }}
                        >
                          ✓
                        </motion.span>
                      )}
                    </div>
                    {g.dueDate && (
                      <p className="text-xs text-[var(--muted)] mt-0.5 ml-4">
                        due {shortDate(g.dueDate)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    className="opacity-0 group-hover:opacity-100 transition text-[var(--muted)] hover:text-[var(--danger)]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="relative h-2 rounded-full bg-[var(--surface)] overflow-hidden mb-2">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: g.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, pct)}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  />
                  {isDone && (
                    <motion.div
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">
                    {g.current} / {g.target} {g.unit}{" "}
                    <span style={{ color: isDone ? g.color : undefined }}>
                      ({pct}%)
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => bump(g.id, -1, g.color, g.current, g.target)}
                      className="w-6 h-6 rounded-md bg-[var(--surface)] hover:bg-[var(--border)] flex items-center justify-center"
                    >
                      <Minus size={10} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => bump(g.id, 1, g.color, g.current, g.target)}
                      className="w-6 h-6 rounded-md bg-[var(--surface)] hover:bg-[var(--border)] flex items-center justify-center"
                    >
                      <Plus size={10} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
