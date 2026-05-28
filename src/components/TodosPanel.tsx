"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
  Plus,
  CircleCheck,
  Circle,
  ListChecks,
  Trash2,
  Flag,
  Repeat,
  GripVertical,
  Calendar,
  Clock,
  Bell,
} from "lucide-react";
import { useStore, useTodosFor } from "@/lib/store";
import { celebrateBig } from "@/lib/celebrate";
import { soundCheck, soundGoal } from "@/lib/sound";
import { PRIORITY_COLOR } from "@/lib/types";
import type { Todo } from "@/lib/types";
import { ScheduleView } from "./ScheduleView";

function PriorityFlag({ priority }: { priority?: "low" | "med" | "high" }) {
  if (!priority) return null;
  return (
    <Flag
      size={11}
      style={{ color: PRIORITY_COLOR[priority], fill: PRIORITY_COLOR[priority] }}
    />
  );
}

export function TodosPanel() {
  const selectedDate = useStore((s) => s.selectedDate);
  const goals = useStore((s) => s.goals);
  const todos = useTodosFor(selectedDate);
  const addTodo = useStore((s) => s.addTodo);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const cyclePriority = useStore((s) => s.cyclePriority);
  const reorderTodos = useStore((s) => s.reorderTodos);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const soundEnabled = useStore((s) => s.settings.soundEnabled);
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState<string>("");
  const [remindTime, setRemindTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [view, setView] = useState<"list" | "schedule">("list");
  const [serverArmed, setServerArmed] = useState<number | null>(null);
  const wasAllDone = useRef(false);

  useEffect(() => {
    function onSync(event: Event) {
      const detail = (event as CustomEvent<{ total?: number }>).detail;
      if (typeof detail?.total === "number") setServerArmed(detail.total);
    }
    window.addEventListener("life-os:schedule-sync", onSync);
    return () => window.removeEventListener("life-os:schedule-sync", onSync);
  }, []);

  function nextQuarterTime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15, 0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function submit() {
    if (!text.trim()) return;
    addTodo({
      title: text.trim(),
      date: selectedDate,
      goalId: goalId || undefined,
      time: remindTime || undefined,
      durationMinutes: remindTime ? duration : undefined,
    });
    setText("");
    window.dispatchEvent(new Event("life-os:force-schedule-sync"));
  }

  function toggle(id: string) {
    const wasDone = todos.find((t) => t.id === id)?.done;
    toggleTodo(id);
    if (!wasDone && soundEnabled) soundCheck();
    setTimeout(() => {
      const fresh = useStore.getState().todos.filter((t) => t.date === selectedDate);
      const allDone = fresh.length > 0 && fresh.every((t) => t.done);
      if (allDone && !wasAllDone.current) {
        if (soundEnabled) soundGoal();
        celebrateBig();
        wasAllDone.current = true;
      } else if (!allDone) {
        wasAllDone.current = false;
      }
    }, 0);
  }

  function handleReorder(newOrder: Todo[]) {
    reorderTodos(
      selectedDate,
      newOrder.map((t) => t.id)
    );
  }

  const done = todos.filter((t) => t.done).length;
  const pct = todos.length > 0 ? Math.round((done / todos.length) * 100) : 0;
  const timedTodos = useMemo(() => todos.filter((t) => t.time && !t.done), [todos]);

  return (
    <section className="glass rounded-2xl p-4 flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
          <ListChecks size={14} />
          Today
        </h2>
        <div className="flex items-center gap-2">
          {todos.length > 0 && view === "list" && (
            <motion.span
              key={`${done}/${todos.length}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xs text-[var(--muted)]"
            >
              {done}/{todos.length}{" "}
              <span
                className={`font-semibold ${pct === 100 ? "text-[var(--success)]" : "text-[var(--accent)]"}`}
              >
                {pct}%
              </span>
            </motion.span>
          )}
          {timedTodos.length > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--success)]">
              <Bell size={11} />
              {serverArmed ?? timedTodos.length} armed
            </span>
          )}
          <div className="flex p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <button
              onClick={() => setView("list")}
              className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 transition ${view === "list" ? "bg-[var(--surface)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}
            >
              <ListChecks size={10} /> List
            </button>
            <button
              onClick={() => setView("schedule")}
              className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 transition ${view === "schedule" ? "bg-[var(--surface)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}
            >
              <Calendar size={10} /> Schedule
            </button>
          </div>
        </div>
      </div>

      {view === "schedule" ? (
        <ScheduleView />
      ) : (
      <>
      <div className="flex flex-col gap-2 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
        <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a task…"
          className="flex-1 bg-transparent text-sm placeholder:text-[var(--muted)] px-2"
        />
        {goals.length > 0 && (
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="bg-[var(--surface)] text-xs px-2 py-1 rounded-md border border-[var(--border)]"
          >
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={submit}
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/20"
        >
          <Plus size={14} />
        </motion.button>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="flex items-center gap-1 text-[var(--muted)]">
            <Clock size={11} /> Reminder
          </span>
          <input
            type="time"
            value={remindTime}
            onChange={(e) => setRemindTime(e.target.value)}
            className="bg-[var(--surface)] px-2 py-1 rounded-md border border-[var(--border)] min-w-[116px]"
          />
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="bg-[var(--surface)] px-2 py-1 rounded-md border border-[var(--border)]"
            disabled={!remindTime}
          >
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setRemindTime(remindTime ? "" : nextQuarterTime())}
            className="px-2 py-1 rounded-md bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)]"
          >
            {remindTime ? "No reminder" : "Next slot"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-hidden -mr-2 pr-2">
        {todos.length === 0 && (
          <div className="text-sm text-[var(--muted)] py-12 text-center flex flex-col items-center gap-2">
            <ListChecks size={28} className="opacity-40" />
            <p>No tasks for this day.</p>
          </div>
        )}
        <Reorder.Group
          axis="y"
          values={todos}
          onReorder={handleReorder}
          className="flex flex-col gap-1"
        >
          <AnimatePresence initial={false}>
            {todos.map((t) => {
              const goal = goals.find((g) => g.id === t.goalId);
              return (
                <Reorder.Item
                  key={t.id}
                  value={t}
                  className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--surface-2)] transition relative"
                >
                  <GripVertical
                    size={12}
                    className="text-[var(--muted)] opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing flex-shrink-0"
                  />
                  {t.priority && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                      style={{ background: PRIORITY_COLOR[t.priority] }}
                    />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => toggle(t.id)}
                    className="flex-shrink-0"
                  >
                    <motion.div
                      animate={{ rotate: t.done ? [0, -10, 0] : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {t.done ? (
                        <CircleCheck
                          size={18}
                          className="text-[var(--success)]"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <Circle
                          size={18}
                          className="text-[var(--muted)] hover:text-[var(--foreground)] transition"
                        />
                      )}
                    </motion.div>
                  </motion.button>
                  <span
                    className={`flex-1 text-sm transition-all min-w-0 truncate ${t.done ? "line-through text-[var(--muted)] opacity-60" : ""}`}
                  >
                    {t.title}
                  </span>
                  {t.recurringId && (
                    <Repeat
                      size={11}
                      className="text-[var(--muted)] flex-shrink-0"
                    />
                  )}
                  {t.time ? (
                    <button
                      onClick={() => updateTodo(t.id, { time: undefined, durationMinutes: undefined })}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20 whitespace-nowrap"
                      title="Reminder armed. Click to remove time."
                    >
                      <Bell size={10} />
                      {t.time}
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        updateTodo(t.id, {
                          time: nextQuarterTime(),
                          durationMinutes: 30,
                        })
                      }
                      className="sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap"
                      title="Add reminder"
                    >
                      <Clock size={10} /> remind
                    </button>
                  )}
                  <button
                    onClick={() => cyclePriority(t.id)}
                    className="opacity-0 group-hover:opacity-100 transition flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-[var(--border)] rounded"
                    title="Cycle priority"
                  >
                    <PriorityFlag priority={t.priority} />
                    {!t.priority && (
                      <Flag size={11} className="text-[var(--muted)]" />
                    )}
                  </button>
                  {goal && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{
                        background: `${goal.color}22`,
                        color: goal.color,
                      }}
                    >
                      {goal.title}
                    </span>
                  )}
                  <button
                    onClick={() => deleteTodo(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)] flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </Reorder.Item>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
      </div>
      </>
      )}
    </section>
  );
}
