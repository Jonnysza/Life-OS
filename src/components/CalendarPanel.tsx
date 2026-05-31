"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEventsFor, useStore, useTodosFor } from "@/lib/store";
import { fromDateKey, toDateKey } from "@/lib/utils";
import { soundCheck } from "@/lib/sound";

type DayFilter = "all" | "schedule" | "tasks" | "habits" | "events";

function prettyTime(time?: string) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`;
}

export function CalendarPanel() {
  const [cursor, setCursor] = useState(new Date());
  const [filter, setFilter] = useState<DayFilter>("all");
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const allTodos = useStore((s) => s.todos);
  const allEvents = useStore((s) => s.events);
  const habits = useStore((s) => s.habits.filter((h) => !h.archived));
  const habitChecks = useStore((s) => s.habitChecks);
  const addEvent = useStore((s) => s.addEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const toggleHabit = useStore((s) => s.toggleHabit);
  const soundEnabled = useStore((s) => s.settings.soundEnabled);

  const dayTodos = useTodosFor(selectedDate);
  const dayEvents = useEventsFor(selectedDate);
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [showAddEvent, setShowAddEvent] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const activity = useMemo(() => {
    const m = new Map<
      string,
      { todos: number; done: number; events: number; habitsDone: number }
    >();
    for (const t of allTodos) {
      const entry = m.get(t.date) ?? {
        todos: 0,
        done: 0,
        events: 0,
        habitsDone: 0,
      };
      entry.todos++;
      if (t.done) entry.done++;
      m.set(t.date, entry);
    }
    for (const ev of allEvents) {
      const entry = m.get(ev.date) ?? {
        todos: 0,
        done: 0,
        events: 0,
        habitsDone: 0,
      };
      entry.events++;
      m.set(ev.date, entry);
    }
    for (const check of habitChecks) {
      const entry = m.get(check.date) ?? {
        todos: 0,
        done: 0,
        events: 0,
        habitsDone: 0,
      };
      entry.habitsDone++;
      m.set(check.date, entry);
    }
    return m;
  }, [allEvents, allTodos, habitChecks]);

  const checkedHabitIds = useMemo(
    () =>
      new Set(
        habitChecks
          .filter((c) => c.date === selectedDate)
          .map((c) => c.habitId)
      ),
    [habitChecks, selectedDate]
  );

  const selectedDay = fromDateKey(selectedDate);
  const doneTasks = dayTodos.filter((t) => t.done).length;
  const doneHabits = habits.filter((habit) => checkedHabitIds.has(habit.id)).length;
  const timedItems = [
    ...dayTodos
      .filter((t) => t.time)
      .map((t) => ({
        id: t.id,
        kind: "task" as const,
        title: t.title,
        time: t.time,
        done: t.done,
        durationMinutes: t.durationMinutes,
      })),
    ...dayEvents
      .filter((e) => e.time)
      .map((e) => ({
        id: e.id,
        kind: "event" as const,
        title: e.title,
        time: e.time,
        done: false,
        durationMinutes: e.durationMinutes,
      })),
  ].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  function submitEvent() {
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      date: selectedDate,
      time: eventTime || undefined,
    });
    setEventTitle("");
    setEventTime("");
    setShowAddEvent(false);
    window.dispatchEvent(new Event("life-os:force-schedule-sync"));
  }

  function toggleHabitForDay(habitId: string) {
    const wasChecked = checkedHabitIds.has(habitId);
    toggleHabit(habitId, selectedDate);
    if (!wasChecked && soundEnabled) soundCheck();
  }

  function toggleTask(todoId: string) {
    const wasDone = dayTodos.find((t) => t.id === todoId)?.done;
    toggleTodo(todoId);
    if (!wasDone && soundEnabled) soundCheck();
  }

  const showSchedule = filter === "all" || filter === "schedule";
  const showTasks = filter === "all" || filter === "tasks";
  const showHabits = filter === "all" || filter === "habits";
  const showEvents = filter === "all" || filter === "events";

  return (
    <section className="glass rounded-2xl p-4 flex flex-col gap-4 h-full min-h-[560px]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
            <CalendarDays size={14} />
            Calendar
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            {format(selectedDay, "EEEE, MMM d")} - {doneTasks}/{dayTodos.length} tasks -{" "}
            {doneHabits}/{habits.length} habits - {dayEvents.length} events
          </p>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="w-8 h-8 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
            title="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => {
              setCursor(new Date());
              setSelectedDate(toDateKey(new Date()));
            }}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--surface-2)] hover:bg-[var(--border)]"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-8 h-8 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
            title="Next month"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="w-8 h-8 rounded-md bg-[var(--accent)] text-white flex items-center justify-center"
            title={showAddEvent ? "Close event form" : "Add event"}
          >
            {showAddEvent ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddEvent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 overflow-hidden"
          >
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
              <input
                autoFocus
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitEvent()}
                placeholder="Event title"
                className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm"
              />
              <button
                onClick={submitEvent}
                className="px-3 py-2 rounded-md bg-[var(--accent)] text-white text-sm"
              >
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)] min-h-0">
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              {format(cursor, "MMMM yyyy")}
            </h3>
            <div className="text-[11px] text-[var(--muted)]">
              dots: events / tasks / habits
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = toDateKey(d);
              const isSelected = key === selectedDate;
              const inMonth = isSameMonth(d, cursor);
              const a = activity.get(key);
              const taskPct = a && a.todos > 0 ? a.done / a.todos : 0;
              const habitPct =
                habits.length > 0 ? Math.min(1, (a?.habitsDone ?? 0) / habits.length) : 0;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`min-h-16 sm:min-h-20 rounded-lg border p-1.5 text-left transition relative overflow-hidden ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)]/15"
                      : "border-[var(--border)] hover:border-[var(--muted)] bg-[var(--surface-2)]/55"
                  } ${!inMonth ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium ${
                        isToday(d) ? "text-[var(--accent)]" : ""
                      }`}
                    >
                      {format(d, "d")}
                    </span>
                    {a?.events ? (
                      <span className="text-[10px] text-[var(--muted)]">
                        {a.events}
                      </span>
                    ) : null}
                  </div>
                  <div className="absolute left-1.5 right-1.5 bottom-1.5 flex gap-1">
                    {a?.events ? (
                      <span className="h-1 flex-1 rounded-full bg-[var(--accent-2)]" />
                    ) : null}
                    {a?.todos ? (
                      <span
                        className="h-1 flex-1 rounded-full"
                        style={{
                          background:
                            taskPct === 1 ? "var(--success)" : "var(--muted)",
                        }}
                      />
                    ) : null}
                    {habits.length > 0 && habitPct > 0 ? (
                      <span
                        className="h-1 flex-1 rounded-full bg-[var(--success)]"
                        style={{ opacity: Math.max(0.35, habitPct) }}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex flex-col gap-3 min-h-0">
          <div className="flex p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] overflow-x-auto scroll-hidden">
            {[
              ["all", "All"],
              ["schedule", "Schedule"],
              ["tasks", "Tasks"],
              ["habits", "Habits"],
              ["events", "Events"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value as DayFilter)}
                className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition ${
                  filter === value
                    ? "bg-[var(--surface)] text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-hidden pr-1 space-y-3">
            {showSchedule && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
                  Timed schedule
                </h3>
                <div className="flex flex-col gap-1.5">
                  {timedItems.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-2">
                      No timed blocks on this day.
                    </p>
                  ) : (
                    timedItems.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2"
                      >
                        <Clock size={13} className="text-[var(--muted)]" />
                        <span className="w-16 text-xs font-mono text-[var(--muted)]">
                          {prettyTime(item.time)}
                        </span>
                        <span
                          className={`text-sm flex-1 min-w-0 truncate ${
                            item.done ? "line-through opacity-60" : ""
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.durationMinutes ? (
                          <span className="text-[10px] text-[var(--muted)]">
                            {item.durationMinutes}m
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {showTasks && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
                  Tasks
                </h3>
                <div className="flex flex-col gap-1.5">
                  {dayTodos.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-2">
                      No tasks on this day.
                    </p>
                  ) : (
                    dayTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className="group flex items-center gap-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-2 py-2"
                      >
                        <button
                          onClick={() => toggleTask(todo.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center"
                        >
                          {todo.done ? (
                            <CheckCircle2 size={18} className="text-[var(--success)]" />
                          ) : (
                            <Circle size={18} className="text-[var(--muted)]" />
                          )}
                        </button>
                        <span
                          className={`text-sm flex-1 min-w-0 truncate ${
                            todo.done ? "line-through opacity-60" : ""
                          }`}
                        >
                          {todo.title}
                        </span>
                        {todo.time ? (
                          <span className="text-[10px] text-[var(--muted)]">
                            {prettyTime(todo.time)}
                          </span>
                        ) : null}
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--danger)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {showHabits && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
                  Habits
                </h3>
                <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
                  {habits.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-2">
                      No habits yet.
                    </p>
                  ) : (
                    habits.map((habit) => {
                      const checked = checkedHabitIds.has(habit.id);
                      return (
                        <button
                          key={habit.id}
                          onClick={() => toggleHabitForDay(habit.id)}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                            checked
                              ? "border-[var(--success)]/25 bg-[var(--success)]/10"
                              : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--muted)]"
                          }`}
                        >
                          {checked ? (
                            <CheckCircle2
                              size={17}
                              className="text-[var(--success)] flex-shrink-0"
                            />
                          ) : (
                            <Circle
                              size={17}
                              className="text-[var(--muted)] flex-shrink-0"
                            />
                          )}
                          <span className="text-base leading-none">{habit.emoji}</span>
                          <span className="text-sm flex-1 min-w-0 truncate">
                            {habit.title}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {showEvents && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
                  Events
                </h3>
                <div className="flex flex-col gap-1.5">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-2">
                      No events on this day.
                    </p>
                  ) : (
                    dayEvents
                      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                      .map((event) => (
                        <div
                          key={event.id}
                          className="group flex items-center gap-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2"
                        >
                          <span
                            className="w-1 self-stretch rounded-full"
                            style={{ background: event.color ?? "var(--accent-2)" }}
                          />
                          <span className="text-xs font-mono text-[var(--muted)] w-16">
                            {event.time ? prettyTime(event.time) : "Anytime"}
                          </span>
                          <span className="text-sm flex-1 min-w-0 truncate">
                            {event.title}
                          </span>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--danger)]"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
