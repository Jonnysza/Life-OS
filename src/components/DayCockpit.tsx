"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  addDays,
  addMonths,
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
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Flame,
  ListChecks,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useShallow } from "zustand/shallow";
import {
  useEventsFor,
  useNoteFor,
  useStore,
  useTodosFor,
} from "@/lib/store";
import { GOAL_COLORS, PRIORITY_COLOR } from "@/lib/types";
import type { CalEvent, Goal, Habit, Todo } from "@/lib/types";
import { fromDateKey, shortDate, toDateKey } from "@/lib/utils";
import { soundCheck } from "@/lib/sound";
import { celebrate, celebrateBig } from "@/lib/celebrate";
import { fetchMe } from "@/lib/sync/client";
import { googleCalendarStatus } from "@/lib/google/client";
import {
  getCurrentSubscription,
  pushSupported,
  registerServiceWorker,
} from "@/lib/push/client";

type ComposerKind = "task" | "habit" | "event";
type HabitFilter = "needed" | "all" | "done";
type MobileTab = "today" | "schedule" | "goals" | "notes";

type DayItem =
  | {
      kind: "task";
      id: string;
      title: string;
      time?: string;
      durationMinutes?: number;
      done: boolean;
      color: string;
      goalTitle?: string;
      source: Todo;
    }
  | {
      kind: "habit";
      id: string;
      title: string;
      time?: undefined;
      durationMinutes?: undefined;
      done: boolean;
      color: string;
      streak: number;
      recent: { date: string; done: boolean }[];
      source: Habit;
    }
  | {
      kind: "event";
      id: string;
      title: string;
      time?: string;
      durationMinutes?: number;
      done: false;
      color: string;
      source: CalEvent;
    };

function prettyTime(time?: string) {
  if (!time) return "Anytime";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`;
}

function minutesFor(time?: string) {
  if (!time) return Number.POSITIVE_INFINITY;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function nextQuarterTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15, 0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function recentDates(endDate: string, count: number) {
  const end = fromDateKey(endDate);
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (count - 1 - idx));
    return toDateKey(d);
  });
}

function habitStreak(habitId: string, checkKeys: Set<string>, date: string) {
  let streak = 0;
  const d = fromDateKey(date);
  while (checkKeys.has(`${habitId}:${toDateKey(d)}`)) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function formatDuration(minutes: number) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function StatusChip({
  armed,
}: {
  armed: number;
}) {
  const [label, setLabel] = useState("Checking");
  const [tone, setTone] = useState<"good" | "warn" | "muted">("muted");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, calendar] = await Promise.all([
          fetchMe(),
          googleCalendarStatus().catch(() => ({
            configured: false,
            redis: false,
            connected: false,
          })),
        ]);
        let subscribed = false;
        if (pushSupported() && Notification.permission === "granted") {
          await registerServiceWorker().catch(() => undefined);
          subscribed = Boolean(
            await Promise.race([
              getCurrentSubscription(),
              new Promise<null>((resolve) => {
                window.setTimeout(() => resolve(null), 1200);
              }),
            ])
          );
        }
        if (cancelled) return;
        if (!me.configured || !calendar.configured) {
          setLabel("Needs Google keys");
          setTone("warn");
        } else if (
          !pushSupported() ||
          Notification.permission !== "granted" ||
          !subscribed
        ) {
          setLabel("Notifications off");
          setTone("warn");
        } else if (armed > 0) {
          setLabel(`${armed} armed`);
          setTone("good");
        } else if (calendar.connected || me.loggedIn) {
          setLabel("Connected");
          setTone("good");
        } else {
          setLabel("Local only");
          setTone("muted");
        }
      } catch {
        if (!cancelled) {
          setLabel("Local only");
          setTone("muted");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [armed]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border ${
        tone === "good"
          ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20"
          : tone === "warn"
            ? "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20"
            : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
      }`}
    >
      <Bell size={11} />
      {label}
    </span>
  );
}

function CompletionRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="w-12 h-12 rounded-full grid place-items-center text-xs font-semibold"
      style={{
        background: `conic-gradient(var(--accent) ${clamped}%, var(--surface-2) ${clamped}% 100%)`,
      }}
    >
      <div className="w-9 h-9 rounded-full bg-[var(--surface)] grid place-items-center">
        {clamped}%
      </div>
    </div>
  );
}

function ItemIcon({ item }: { item: DayItem }) {
  if (item.kind === "task") {
    return item.done ? (
      <CheckCircle2 size={18} className="text-[var(--success)]" />
    ) : (
      <Circle size={18} className="text-[var(--muted)]" />
    );
  }
  if (item.kind === "habit") {
    return item.done ? (
      <CheckCircle2 size={18} style={{ color: item.color }} />
    ) : (
      <Circle size={18} className="text-[var(--muted)]" />
    );
  }
  return <CalendarDays size={17} className="text-[var(--accent-2)]" />;
}

function DayItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: DayItem;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 rounded-lg border bg-[var(--surface-2)]/80 transition ${
        item.done
          ? "border-[var(--success)]/25"
          : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <button
        onClick={item.kind === "event" ? undefined : onToggle}
        className="w-7 h-7 rounded-md grid place-items-center"
        title={item.kind === "event" ? "Event" : "Toggle complete"}
      >
        <ItemIcon item={item} />
      </button>

      <button
        onClick={item.kind === "event" ? undefined : onToggle}
        className="min-w-0 text-left"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 border border-[var(--border)] text-[var(--muted)] flex-shrink-0"
          >
            {item.kind}
          </span>
          <span
            className={`text-sm font-medium truncate ${
              item.done ? "line-through opacity-60" : ""
            }`}
          >
            {item.kind === "habit" ? `${item.source.emoji} ${item.title}` : item.title}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted)] min-w-0">
          {item.time && (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {prettyTime(item.time)}
              {item.durationMinutes ? ` - ${item.durationMinutes}m` : ""}
            </span>
          )}
          {item.kind === "habit" && (
            <span className="inline-flex items-center gap-1">
              <Flame size={10} />
              {item.streak}
            </span>
          )}
          {item.kind === "task" && item.goalTitle && (
            <span className="truncate">{item.goalTitle}</span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2">
        {item.kind === "habit" && (
          <div className="hidden sm:grid grid-cols-7 gap-0.5 w-16">
            {item.recent.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className="h-1.5 rounded-[2px]"
                style={{
                  background: d.done ? item.color : "var(--surface)",
                  opacity: d.done ? 1 : 0.45,
                }}
              />
            ))}
          </div>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-md grid place-items-center text-[var(--muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function MiniCalendar({
  selectedDate,
  setSelectedDate,
  activity,
  habitsTotal,
}: {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  activity: Map<string, { tasks: number; doneTasks: number; events: number; habitsDone: number }>;
  habitsTotal: number;
}) {
  const [cursor, setCursor] = useState(() => fromDateKey(selectedDate));

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const out = [];
    const current = new Date(start);
    while (current <= end) {
      out.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return out;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(fromDateKey(selectedDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  return (
    <div className="space-y-3">
      <div className="lg:hidden flex gap-1 overflow-x-auto scroll-hidden pb-1">
        {weekDays.map((day) => {
          const key = toDateKey(day);
          const selected = key === selectedDate;
          const a = activity.get(key);
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              className={`min-w-14 h-14 rounded-lg border flex flex-col items-center justify-center ${
                selected
                  ? "bg-[var(--accent)] text-white border-transparent"
                  : "bg-[var(--surface-2)] border-[var(--border)]"
              }`}
            >
              <span className="text-[9px] uppercase opacity-75">
                {format(day, "EEE")}
              </span>
              <span className="text-base font-semibold leading-tight">
                {format(day, "d")}
              </span>
              {(a?.tasks || a?.events || a?.habitsDone) && (
                <span className="mt-1 w-5 h-1 rounded-full bg-current opacity-70" />
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden lg:block rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="w-7 h-7 rounded-md hover:bg-[var(--surface)] grid place-items-center"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-xs font-semibold">{format(cursor, "MMMM yyyy")}</p>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-7 h-7 rounded-md hover:bg-[var(--surface)] grid place-items-center"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[9px] text-[var(--muted)] uppercase mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
            <div key={`${d}-${idx}`} className="text-center py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day) => {
            const key = toDateKey(day);
            const selected = key === selectedDate;
            const inMonth = isSameMonth(day, cursor);
            const a = activity.get(key);
            const taskPct = a && a.tasks > 0 ? a.doneTasks / a.tasks : 0;
            const habitPct =
              habitsTotal > 0 ? Math.min(1, (a?.habitsDone ?? 0) / habitsTotal) : 0;

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={`relative h-9 rounded-md border text-xs transition ${
                  selected
                    ? "bg-[var(--accent)] text-white border-transparent"
                    : "bg-[var(--surface)]/65 border-[var(--border)] hover:border-[var(--muted)]"
                } ${!inMonth ? "opacity-35" : ""}`}
              >
                <span className={isToday(day) && !selected ? "text-[var(--accent)]" : ""}>
                  {format(day, "d")}
                </span>
                {(a?.tasks || a?.events || a?.habitsDone) && (
                  <span className="absolute left-1 right-1 bottom-1 flex gap-0.5">
                    {a.events > 0 && (
                      <span className="h-0.5 flex-1 rounded-full bg-[var(--accent-2)]" />
                    )}
                    {a.tasks > 0 && (
                      <span
                        className="h-0.5 flex-1 rounded-full"
                        style={{
                          background:
                            taskPct === 1 ? "var(--success)" : "var(--muted)",
                        }}
                      />
                    )}
                    {habitPct > 0 && (
                      <span
                        className="h-0.5 flex-1 rounded-full bg-[var(--success)]"
                        style={{ opacity: Math.max(0.35, habitPct) }}
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SchedulePreview({
  timedItems,
}: {
  timedItems: DayItem[];
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Schedule
        </h3>
        <span className="text-[10px] text-[var(--muted)]">
          {timedItems.length} timed
        </span>
      </div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto scroll-hidden">
        {timedItems.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-3">
            No timed blocks. Add a time in the composer to arm the day.
          </p>
        ) : (
          timedItems.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="grid grid-cols-[54px_minmax(0,1fr)] gap-2 items-center text-xs"
            >
              <span className="font-mono text-[var(--muted)]">
                {prettyTime(item.time).replace(" ", "")}
              </span>
              <div className="h-8 rounded-md px-2 flex items-center min-w-0 border border-[var(--border)] bg-[var(--surface)]">
                <span
                  className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0"
                  style={{ background: item.color }}
                />
                <span className="truncate">{item.title}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function DayCockpit() {
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const todos = useTodosFor(selectedDate);
  const events = useEventsFor(selectedDate);
  const goals = useStore(useShallow((s) => s.goals.filter((g) => !g.archived)));
  const habits = useStore(useShallow((s) => s.habits.filter((h) => !h.archived)));
  const habitChecks = useStore((s) => s.habitChecks);
  const allTodos = useStore((s) => s.todos);
  const allEvents = useStore((s) => s.events);
  const note = useNoteFor(selectedDate);

  const addTodo = useStore((s) => s.addTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const addHabit = useStore((s) => s.addHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const toggleHabit = useStore((s) => s.toggleHabit);
  const addEvent = useStore((s) => s.addEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const upsertNote = useStore((s) => s.upsertNote);
  const incrementGoal = useStore((s) => s.incrementGoal);
  const soundEnabled = useStore((s) => s.settings.soundEnabled);

  const [kind, setKind] = useState<ComposerKind>("task");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [goalId, setGoalId] = useState("");
  const [habitFilter, setHabitFilter] = useState<HabitFilter>("needed");
  const [search, setSearch] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");
  const [serverArmed, setServerArmed] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState(note?.content ?? "");

  useEffect(() => {
    setNoteDraft(note?.content ?? "");
  }, [note?.content, note?.id, selectedDate]);

  useEffect(() => {
    if (noteDraft === (note?.content ?? "")) return;
    const timer = setTimeout(() => upsertNote(selectedDate, noteDraft), 450);
    return () => clearTimeout(timer);
  }, [noteDraft, note?.content, selectedDate, upsertNote]);

  useEffect(() => {
    function onSync(event: Event) {
      const detail = (event as CustomEvent<{ total?: number }>).detail;
      if (typeof detail?.total === "number") setServerArmed(detail.total);
    }
    window.addEventListener("life-os:schedule-sync", onSync);
    return () => window.removeEventListener("life-os:schedule-sync", onSync);
  }, []);

  const checkKeys = useMemo(
    () => new Set(habitChecks.map((c) => `${c.habitId}:${c.date}`)),
    [habitChecks]
  );
  const checkedHabitIds = useMemo(
    () =>
      new Set(
        habitChecks
          .filter((check) => check.date === selectedDate)
          .map((check) => check.habitId)
      ),
    [habitChecks, selectedDate]
  );
  const recent = useMemo(() => recentDates(selectedDate, 7), [selectedDate]);

  const dayItems = useMemo<DayItem[]>(() => {
    const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
    const taskItems: DayItem[] = todos.map((todo) => {
      const goal = todo.goalId ? goalMap.get(todo.goalId) : undefined;
      return {
        kind: "task",
        id: todo.id,
        title: todo.title,
        time: todo.time,
        durationMinutes: todo.durationMinutes,
        done: todo.done,
        color: goal?.color ?? PRIORITY_COLOR[todo.priority ?? "med"],
        goalTitle: goal?.title,
        source: todo,
      };
    });
    const habitItems: DayItem[] = habits.map((habit) => ({
      kind: "habit",
      id: habit.id,
      title: habit.title,
      done: checkedHabitIds.has(habit.id),
      color: habit.color,
      streak: habitStreak(habit.id, checkKeys, selectedDate),
      recent: recent.map((date) => ({
        date,
        done: checkKeys.has(`${habit.id}:${date}`),
      })),
      source: habit,
    }));
    const eventItems: DayItem[] = events.map((event) => ({
      kind: "event",
      id: event.id,
      title: event.title,
      time: event.time,
      durationMinutes: event.durationMinutes,
      done: false,
      color: event.color ?? "var(--accent-2)",
      source: event,
    }));
    return [...taskItems, ...habitItems, ...eventItems];
  }, [checkedHabitIds, checkKeys, events, goals, habits, recent, selectedDate, todos]);

  const timedItems = useMemo(
    () =>
      dayItems
        .filter((item) => item.time)
        .sort((a, b) => minutesFor(a.time) - minutesFor(b.time)),
    [dayItems]
  );

  const checklistItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    return dayItems
      .filter((item) => {
        if (text && !item.title.toLowerCase().includes(text)) return false;
        if (item.kind === "habit") {
          if (habitFilter === "needed") return !item.done;
          if (habitFilter === "done") return item.done;
        }
        return true;
      })
      .sort((a, b) => {
        const byDone = Number(a.done) - Number(b.done);
        if (byDone) return byDone;
        const byTime = minutesFor(a.time) - minutesFor(b.time);
        if (Number.isFinite(byTime) && byTime !== 0) return byTime;
        return a.title.localeCompare(b.title);
      });
  }, [dayItems, habitFilter, search]);

  const activity = useMemo(() => {
    const map = new Map<
      string,
      { tasks: number; doneTasks: number; events: number; habitsDone: number }
    >();
    for (const todo of allTodos) {
      const entry = map.get(todo.date) ?? {
        tasks: 0,
        doneTasks: 0,
        events: 0,
        habitsDone: 0,
      };
      entry.tasks++;
      if (todo.done) entry.doneTasks++;
      map.set(todo.date, entry);
    }
    for (const event of allEvents) {
      const entry = map.get(event.date) ?? {
        tasks: 0,
        doneTasks: 0,
        events: 0,
        habitsDone: 0,
      };
      entry.events++;
      map.set(event.date, entry);
    }
    for (const check of habitChecks) {
      const entry = map.get(check.date) ?? {
        tasks: 0,
        doneTasks: 0,
        events: 0,
        habitsDone: 0,
      };
      entry.habitsDone++;
      map.set(check.date, entry);
    }
    return map;
  }, [allEvents, allTodos, habitChecks]);

  const taskDone = todos.filter((todo) => todo.done).length;
  const habitDone = habits.filter((habit) => checkedHabitIds.has(habit.id)).length;
  const actionableTotal = todos.length + habits.length;
  const actionableDone = taskDone + habitDone;
  const pct =
    actionableTotal > 0 ? Math.round((actionableDone / actionableTotal) * 100) : 0;
  const blockedMinutes = timedItems.reduce(
    (sum, item) => sum + (item.durationMinutes ?? (item.kind === "event" ? 60 : 30)),
    0
  );
  const armed = serverArmed ?? todos.filter((todo) => todo.time && !todo.done).length;
  const nextUp =
    timedItems.find((item) => !item.done && minutesFor(item.time) >= minutesFor(nextQuarterTime()) - 15) ??
    dayItems.find((item) => !item.done);

  function submit() {
    const clean = title.trim();
    if (!clean) return;
    if (kind === "task") {
      addTodo({
        title: clean,
        date: selectedDate,
        goalId: goalId || undefined,
        time: time || undefined,
        durationMinutes: time ? duration : undefined,
      });
    } else if (kind === "habit") {
      addHabit({
        title: clean,
        emoji: "✓",
        color: GOAL_COLORS[habits.length % GOAL_COLORS.length],
      });
    } else {
      addEvent({
        title: clean,
        date: selectedDate,
        time: time || undefined,
        durationMinutes: time ? duration : undefined,
      });
    }
    setTitle("");
    if (time || kind === "event") {
      window.dispatchEvent(new Event("life-os:force-schedule-sync"));
    }
  }

  function toggleItem(item: DayItem) {
    if (item.kind === "task") {
      const wasDone = item.done;
      toggleTodo(item.id);
      if (!wasDone && soundEnabled) soundCheck();
      if (!wasDone) celebrate(item.color);
    }
    if (item.kind === "habit") {
      const wasDone = item.done;
      toggleHabit(item.id, selectedDate);
      if (!wasDone && soundEnabled) soundCheck();
      if (!wasDone) celebrate(item.color);
    }
  }

  function completeVisible() {
    const toComplete = checklistItems.filter(
      (item) => (item.kind === "habit" || item.kind === "task") && !item.done
    );
    for (const item of toComplete) toggleItem(item);
    if (toComplete.length > 3) celebrateBig();
  }

  function deleteItem(item: DayItem) {
    if (item.kind === "task") deleteTodo(item.id);
    if (item.kind === "habit") deleteHabit(item.id);
    if (item.kind === "event") deleteEvent(item.id);
  }

  const selectedDay = fromDateKey(selectedDate);

  return (
    <section className="glass rounded-2xl p-3 sm:p-4 min-h-[calc(100vh-96px)]">
      <div className="flex flex-col gap-3">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <CompletionRing pct={pct} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                {format(selectedDay, "EEEE, MMM d")}
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">
                Day cockpit
              </h1>
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                {nextUp
                  ? `Next: ${nextUp.title}${nextUp.time ? ` at ${prettyTime(nextUp.time)}` : ""}`
                  : "No next item loaded."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip armed={armed} />
            <span className="rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)]">
              {formatDuration(blockedMinutes)} scheduled
            </span>
            <button
              onClick={() => setSelectedDate(toDateKey(new Date()))}
              className="rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] border border-[var(--border)] px-2.5 py-1 text-[11px]"
            >
              Today
            </button>
          </div>
        </header>

        <div className="lg:hidden">
          <MiniCalendar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            activity={activity}
            habitsTotal={habits.length}
          />
        </div>

        <div className="lg:hidden flex p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] overflow-x-auto scroll-hidden">
          {[
            ["today", "Today"],
            ["schedule", "Schedule"],
            ["goals", "Goals"],
            ["notes", "Notes"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMobileTab(value as MobileTab)}
              className={`flex-1 min-w-20 px-3 py-1.5 rounded-md text-xs ${
                mobileTab === value
                  ? "bg-[var(--surface)] text-[var(--foreground)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="hidden lg:flex flex-col gap-3 min-w-0">
            <MiniCalendar
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              activity={activity}
              habitsTotal={habits.length}
            />
            <SchedulePreview timedItems={timedItems} />
          </aside>

          <main
            className={`min-w-0 flex-col gap-3 ${
              mobileTab === "today" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-2">
              <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <div className="flex p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  {(["task", "habit", "event"] as ComposerKind[]).map((value) => (
                    <button
                      key={value}
                      onClick={() => setKind(value)}
                      className={`px-2.5 py-1 rounded-md text-xs capitalize ${
                        kind === value
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={`Add ${kind}`}
                  className="min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm placeholder:text-[var(--muted)]"
                />
                <button
                  onClick={submit}
                  className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              {kind !== "habit" && (
                <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1"
                  />
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    disabled={!time}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1 disabled:opacity-45"
                  >
                    {[15, 30, 45, 60, 90, 120, 180].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setTime(time ? "" : nextQuarterTime())}
                    className="px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {time ? "Clear time" : "Next slot"}
                  </button>
                  {kind === "task" && goals.length > 0 && (
                    <select
                      value={goalId}
                      onChange={(e) => setGoalId(e.target.value)}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1 min-w-40"
                    >
                      <option value="">No goal</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-3 min-h-[460px] flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <ListChecks size={14} />
                    Today Flow
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {actionableDone}/{actionableTotal} actions - {events.length} event
                    {events.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 rounded-md bg-[var(--surface)] border border-[var(--border)] px-2 py-1">
                    <Search size={12} className="text-[var(--muted)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search"
                      className="bg-transparent text-xs w-28 placeholder:text-[var(--muted)]"
                    />
                  </label>
                  <div className="flex p-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)]">
                    {[
                      ["needed", "Needed"],
                      ["all", "All"],
                      ["done", "Done"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setHabitFilter(value as HabitFilter)}
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          habitFilter === value
                            ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={completeVisible}
                    className="px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[11px] hover:bg-[var(--border)]"
                  >
                    Complete visible
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scroll-hidden space-y-1.5 pr-1">
                <AnimatePresence initial={false}>
                  {checklistItems.map((item) => (
                    <DayItemRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      onToggle={() => toggleItem(item)}
                      onDelete={() => deleteItem(item)}
                    />
                  ))}
                </AnimatePresence>
                {checklistItems.length === 0 && (
                  <div className="py-16 text-center text-sm text-[var(--muted)]">
                    <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                    This view is clear. Add a task, habit, or event above.
                  </div>
                )}
              </div>
            </div>
          </main>

          <section
            className={`min-w-0 flex-col gap-3 ${
              mobileTab === "schedule" ? "flex" : "hidden"
            } lg:hidden`}
          >
            <SchedulePreview timedItems={timedItems} />
          </section>

          <aside
            className={`min-w-0 flex-col gap-3 ${
              mobileTab === "goals" || mobileTab === "notes"
                ? "flex"
                : "hidden lg:flex"
            }`}
          >
            <div
              className={`rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-3 ${
                mobileTab === "notes" ? "hidden lg:block" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <Target size={13} />
                  Goals
                </h3>
                <span className="text-[10px] text-[var(--muted)]">
                  {goals.length} active
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto scroll-hidden">
                {goals.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-3">
                    No goals yet. Add one in Settings or ask AI to build a plan.
                  </p>
                ) : (
                  goals.slice(0, 8).map((goal: Goal) => {
                    const pctGoal =
                      goal.target > 0
                        ? Math.round((goal.current / goal.target) * 100)
                        : 0;
                    return (
                      <div
                        key={goal.id}
                        className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: goal.color }}
                          />
                          <span className="text-xs font-medium truncate flex-1">
                            {goal.title}
                          </span>
                          <span className="text-[10px] text-[var(--muted)]">
                            {pctGoal}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <motion.div
                            initial={false}
                            animate={{ width: `${Math.min(100, pctGoal)}%` }}
                            className="h-full rounded-full"
                            style={{ background: goal.color }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--muted)]">
                          <span>
                            {goal.current}/{goal.target} {goal.unit}
                            {goal.dueDate ? ` - due ${shortDate(goal.dueDate)}` : ""}
                          </span>
                          <button
                            onClick={() => incrementGoal(goal.id, 1)}
                            className="rounded px-1.5 py-0.5 bg-[var(--surface-2)] hover:bg-[var(--border)]"
                          >
                            +1
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div
              className={`rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-3 min-h-64 flex flex-col ${
                mobileTab === "goals" ? "hidden lg:flex" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <NotebookPen size={13} />
                  Notes
                </h3>
                {note && noteDraft !== note.content && (
                  <span className="text-[10px] text-[var(--muted)]">saving</span>
                )}
              </div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Plan, reflect, or capture what matters today."
                className="flex-1 min-h-48 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm leading-relaxed placeholder:text-[var(--muted)]"
              />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
