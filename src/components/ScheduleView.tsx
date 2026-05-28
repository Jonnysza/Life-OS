"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, X, Clock } from "lucide-react";
import { useStore, useTodosFor, useEventsFor } from "@/lib/store";
import { toDateKey } from "@/lib/utils";

const START_HOUR = 5;
const END_HOUR = 24;
const HOUR_PX = 64;
const PX_PER_MIN = HOUR_PX / 60;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;
const SNAP_MIN = 15;

type Block = {
  id: string;
  kind: "todo" | "event";
  title: string;
  time: string;
  durationMinutes: number;
  color: string;
  done?: boolean;
  goalTitle?: string;
};

type LayoutBlock = Block & {
  columnIndex: number;
  columnCount: number;
};

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function prettyTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function snapMinutes(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

function minutesToY(minutes: number): number {
  return (minutes - START_HOUR * 60) * PX_PER_MIN;
}

function yToMinutes(y: number): number {
  return y / PX_PER_MIN + START_HOUR * 60;
}

function layoutOverlappingBlocks(blocks: Block[]): LayoutBlock[] {
  const sorted = [...blocks].sort((a, b) => {
    const byStart = parseTime(a.time) - parseTime(b.time);
    return byStart || a.title.localeCompare(b.title);
  });
  const clusters: Block[][] = [];
  let cluster: Block[] = [];
  let clusterEnd = 0;

  for (const block of sorted) {
    const start = parseTime(block.time);
    const end = start + block.durationMinutes;
    if (cluster.length > 0 && start >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = 0;
    }
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) clusters.push(cluster);

  const laidOut: LayoutBlock[] = [];
  for (const group of clusters) {
    const columnEnds: number[] = [];
    const placed = group.map((block) => {
      const start = parseTime(block.time);
      const end = start + block.durationMinutes;
      let columnIndex = columnEnds.findIndex((value) => value <= start);
      if (columnIndex === -1) {
        columnIndex = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[columnIndex] = end;
      }
      return { ...block, columnIndex, columnCount: 1 };
    });
    const columnCount = Math.max(1, columnEnds.length);
    laidOut.push(
      ...placed.map((block) => ({
        ...block,
        columnCount,
      }))
    );
  }

  return laidOut.sort((a, b) => a.time.localeCompare(b.time));
}

export function ScheduleView() {
  const selectedDate = useStore((s) => s.selectedDate);
  const todos = useTodosFor(selectedDate);
  const events = useEventsFor(selectedDate);
  const goals = useStore((s) => s.goals);
  const updateTodo = useStore((s) => s.updateTodo);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const addTodo = useStore((s) => s.addTodo);

  const [editing, setEditing] = useState<Block | null>(null);
  const [addingAt, setAddingAt] = useState<{ y: number; minutes: number } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      if (toDateKey(d) === selectedDate) {
        setNowMinutes(d.getHours() * 60 + d.getMinutes());
      } else {
        setNowMinutes(null);
      }
    };
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, [selectedDate]);

  useEffect(() => {
    if (nowMinutes != null && scrollRef.current) {
      const y = minutesToY(nowMinutes) - 80;
      scrollRef.current.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }, [selectedDate]);

  const blocks: Block[] = useMemo(() => {
    const out: Block[] = [];
    for (const t of todos) {
      if (!t.time) continue;
      const goal = t.goalId ? goals.find((g) => g.id === t.goalId) : undefined;
      out.push({
        id: t.id,
        kind: "todo",
        title: t.title,
        time: t.time,
        durationMinutes: t.durationMinutes ?? 30,
        color: goal?.color ?? "#8b5cf6",
        done: t.done,
        goalTitle: goal?.title,
      });
    }
    for (const e of events) {
      if (!e.time) continue;
      const goal = e.goalId ? goals.find((g) => g.id === e.goalId) : undefined;
      out.push({
        id: e.id,
        kind: "event",
        title: e.title,
        time: e.time,
        durationMinutes: e.durationMinutes ?? 60,
        color: e.color ?? goal?.color ?? "#06b6d4",
        goalTitle: goal?.title,
      });
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [todos, events, goals]);

  const layoutBlocks = useMemo(() => layoutOverlappingBlocks(blocks), [blocks]);

  const unscheduledTodos = todos.filter((t) => !t.time && !t.done);

  function blockTop(time: string): number {
    return minutesToY(parseTime(time));
  }

  function applyDrag(block: Block, deltaY: number) {
    const newMinutes = snapMinutes(parseTime(block.time) + deltaY / PX_PER_MIN);
    const clamped = Math.max(START_HOUR * 60, Math.min((END_HOUR - 0.25) * 60, newMinutes));
    const patch = { time: formatTime(clamped) };
    if (block.kind === "todo") updateTodo(block.id, patch);
    else updateEvent(block.id, patch);
  }

  function applyResize(block: Block, deltaY: number) {
    const newDuration = snapMinutes(block.durationMinutes + deltaY / PX_PER_MIN);
    const clamped = Math.max(SNAP_MIN, Math.min(8 * 60, newDuration));
    const patch = { durationMinutes: clamped };
    if (block.kind === "todo") updateTodo(block.id, patch);
    else updateEvent(block.id, patch);
  }

  function handleEmptyClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = snapMinutes(yToMinutes(y));
    setAddingAt({ y: minutesToY(minutes), minutes });
    setNewTitle("");
    setNewDuration(30);
  }

  function submitNewBlock() {
    if (!addingAt || !newTitle.trim()) return;
    addTodo({
      title: newTitle.trim(),
      date: selectedDate,
      time: formatTime(addingAt.minutes),
      durationMinutes: newDuration,
    });
    setAddingAt(null);
    setNewTitle("");
  }

  function scheduleUnscheduled(todoId: string, atMinutes: number) {
    updateTodo(todoId, {
      time: formatTime(snapMinutes(atMinutes)),
      durationMinutes: 30,
    });
  }

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    hours.push(h);
  }

  return (
    <div className="flex gap-3 h-full min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-hidden relative"
      >
        <div
          ref={containerRef}
          onClick={handleEmptyClick}
          className="relative ml-12"
          style={{ height: TOTAL_HEIGHT }}
        >
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-[var(--border)] pointer-events-none"
              style={{ top: (h - START_HOUR) * HOUR_PX }}
            >
              <span className="absolute -left-12 -top-2 text-[10px] text-[var(--muted)] font-mono w-10 text-right">
                {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
              </span>
            </div>
          ))}

          {nowMinutes != null &&
            nowMinutes >= START_HOUR * 60 &&
            nowMinutes < END_HOUR * 60 && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: minutesToY(nowMinutes) }}
              >
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-[var(--danger)] shadow-lg shadow-[var(--danger)]/50 animate-pulse" />
                <div className="h-px bg-[var(--danger)]/70" />
              </div>
            )}

          <AnimatePresence>
            {layoutBlocks.map((b) => {
              const top = blockTop(b.time);
              const columnWidth = 100 / b.columnCount;
              return (
                <motion.div
                  key={b.id}
                  layoutId={b.id}
                  drag="y"
                  dragMomentum={false}
                  dragElastic={0}
                  onDragEnd={(_, info) => applyDrag(b, info.offset.y)}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1, top, height: b.durationMinutes * PX_PER_MIN }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  whileDrag={{ scale: 1.04, zIndex: 30 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(b);
                  }}
                  className="absolute rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group"
                  style={{
                    left: `calc(${b.columnIndex * columnWidth}% + 4px)`,
                    width: `calc(${columnWidth}% - 8px)`,
                    background: `linear-gradient(135deg, ${b.color}E6, ${b.color}AA)`,
                    boxShadow: `0 8px 24px -8px ${b.color}80, inset 0 1px 0 rgba(255,255,255,0.15)`,
                    minHeight: 14,
                  }}
                >
                  <div className="absolute inset-0 p-2 flex flex-col text-white pointer-events-none">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {b.kind === "todo" && (
                        <span
                          className={`flex-shrink-0 w-3 h-3 rounded-full border ${b.done ? "bg-white border-white" : "border-white/70"}`}
                        />
                      )}
                      <span
                        className={`text-xs font-semibold truncate ${b.done ? "line-through opacity-70" : ""}`}
                      >
                        {b.title}
                      </span>
                    </div>
                    {b.durationMinutes >= 40 && (
                      <p className="text-[10px] opacity-80 mt-0.5">
                        {prettyTime(b.time)} · {b.durationMinutes}m
                        {b.goalTitle ? ` · ${b.goalTitle}` : ""}
                      </p>
                    )}
                  </div>
                  <motion.div
                    drag="y"
                    dragMomentum={false}
                    dragElastic={0}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDragEnd={(_, info) => applyResize(b, info.offset.y)}
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition"
                  >
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-white/60" />
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {addingAt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute left-1 right-1 z-30 p-2 rounded-lg bg-[var(--surface)] border border-[var(--accent)] shadow-xl"
              style={{ top: addingAt.y, minHeight: newDuration * PX_PER_MIN }}
            >
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewBlock();
                  if (e.key === "Escape") setAddingAt(null);
                }}
                placeholder={`Block at ${prettyTime(formatTime(addingAt.minutes))}…`}
                className="w-full bg-transparent text-sm placeholder:text-[var(--muted)]"
              />
              <div className="flex items-center gap-1 mt-1 text-xs">
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    onClick={() => setNewDuration(m)}
                    className={`px-1.5 py-0.5 rounded ${newDuration === m ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)]"}`}
                  >
                    {m}m
                  </button>
                ))}
                <button
                  onClick={submitNewBlock}
                  className="ml-auto px-2 py-0.5 rounded bg-[var(--accent)] text-white"
                >
                  Add
                </button>
                <button
                  onClick={() => setAddingAt(null)}
                  className="px-1 text-[var(--muted)]"
                >
                  <X size={10} />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {unscheduledTodos.length > 0 && (
        <div className="hidden lg:flex flex-col gap-2 w-44 flex-shrink-0">
          <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
            Unscheduled
          </h3>
          <div className="flex flex-col gap-1.5 overflow-y-auto scroll-hidden">
            {unscheduledTodos.map((t) => {
              const goal = t.goalId ? goals.find((g) => g.id === t.goalId) : undefined;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    const now = new Date();
                    const at =
                      toDateKey(now) === selectedDate
                        ? snapMinutes(now.getHours() * 60 + now.getMinutes())
                        : 9 * 60;
                    scheduleUnscheduled(t.id, Math.max(START_HOUR * 60, at));
                  }}
                  className="text-left p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)] transition group"
                  style={
                    goal
                      ? { borderLeft: `2px solid ${goal.color}` }
                      : undefined
                  }
                >
                  <p className="text-xs truncate flex items-center gap-1.5">
                    <Clock size={10} className="text-[var(--muted)] flex-shrink-0" />
                    {t.title}
                  </p>
                  <p className="text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition">
                    tap to schedule
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditing(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass rounded-2xl border border-[var(--border)] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${editing.color}33`, color: editing.color }}
                >
                  {editing.kind}
                </span>
                <button
                  onClick={() => setEditing(null)}
                  className="w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                onBlur={() => {
                  if (editing.kind === "todo")
                    updateTodo(editing.id, { title: editing.title });
                  else updateEvent(editing.id, { title: editing.title });
                }}
                className="w-full bg-transparent text-lg font-semibold mb-4"
              />
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    Time
                  </label>
                  <input
                    type="time"
                    value={editing.time}
                    onChange={(e) => {
                      setEditing({ ...editing, time: e.target.value });
                      if (editing.kind === "todo")
                        updateTodo(editing.id, { time: e.target.value });
                      else updateEvent(editing.id, { time: e.target.value });
                    }}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md p-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    Duration
                  </label>
                  <select
                    value={editing.durationMinutes}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEditing({ ...editing, durationMinutes: v });
                      if (editing.kind === "todo")
                        updateTodo(editing.id, { durationMinutes: v });
                      else updateEvent(editing.id, { durationMinutes: v });
                    }}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md p-2 text-sm mt-1"
                  >
                    {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m}m` : `${m / 60}h${m % 60 ? " " + (m % 60) + "m" : ""}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editing.kind === "todo" && (
                  <button
                    onClick={() => {
                      toggleTodo(editing.id);
                      setEditing(null);
                    }}
                    className="flex-1 py-2 rounded-lg bg-[var(--success)] text-white text-sm font-medium"
                  >
                    {editing.done ? "Mark not done" : "Mark done"}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (editing.kind === "todo") deleteTodo(editing.id);
                    else deleteEvent(editing.id);
                    setEditing(null);
                  }}
                  className="px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--danger)]/20 text-[var(--danger)] flex items-center gap-1.5 text-sm"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
