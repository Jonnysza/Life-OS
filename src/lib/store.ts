"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import type {
  Goal,
  Todo,
  Note,
  CalEvent,
  RecurringRule,
  Habit,
  HabitCheck,
  Mood,
  FocusSession,
  Settings,
  Priority,
  StickyNote,
} from "./types";
import { GOAL_COLORS } from "./types";
import { toDateKey, uid } from "./utils";
import { ruleMatches } from "./recurrence";

type State = {
  goals: Goal[];
  todos: Todo[];
  notes: Note[];
  events: CalEvent[];
  rules: RecurringRule[];
  habits: Habit[];
  habitChecks: HabitCheck[];
  moods: Mood[];
  focus: FocusSession[];
  stickies: StickyNote[];
  settings: Settings;
  selectedDate: string;
};

type Actions = {
  setSelectedDate: (d: string) => void;
  addGoal: (g: Partial<Goal> & { title: string }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  incrementGoal: (id: string, by: number) => void;
  deleteGoal: (id: string) => void;
  addTodo: (
    t: Partial<Todo> & { title: string; date: string }
  ) => void;
  toggleTodo: (id: string) => void;
  updateTodo: (id: string, patch: Partial<Todo>) => void;
  cyclePriority: (id: string) => void;
  reorderTodos: (date: string, ids: string[]) => void;
  deleteTodo: (id: string) => void;
  upsertNote: (date: string, content: string) => void;
  deleteNote: (id: string) => void;
  addEvent: (e: Partial<CalEvent> & { title: string; date: string }) => void;
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  deleteEvent: (id: string) => void;
  addRule: (r: Omit<RecurringRule, "id" | "archived">) => void;
  deleteRule: (id: string) => void;
  materializeForDate: (date: string) => void;
  addHabit: (h: Partial<Habit> & { title: string; emoji: string }) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (habitId: string, date: string) => void;
  setMood: (date: string, score: 1 | 2 | 3 | 4 | 5, note?: string) => void;
  addFocusSession: (durationMinutes: number) => void;
  addSticky: (note: Partial<StickyNote> & { content: string }) => void;
  updateSticky: (id: string, patch: Partial<StickyNote>) => void;
  deleteSticky: (id: string) => void;
  clearStickies: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  exportData: () => string;
  importData: (json: string) => boolean;
  clearAll: () => void;
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      goals: [],
      todos: [],
      notes: [],
      events: [],
      rules: [],
      habits: [],
      habitChecks: [],
      moods: [],
      focus: [],
      stickies: [],
      settings: { soundEnabled: true },
      selectedDate: toDateKey(new Date()),

      setSelectedDate: (d) => set({ selectedDate: d }),

      addGoal: (g) =>
        set((s) => ({
          goals: [
            ...s.goals,
            {
              id: uid(),
              title: g.title,
              description: g.description,
              target: g.target ?? 100,
              current: g.current ?? 0,
              unit: g.unit ?? "%",
              dueDate: g.dueDate,
              color: g.color ?? GOAL_COLORS[s.goals.length % GOAL_COLORS.length],
              archived: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateGoal: (id, patch) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),

      incrementGoal: (id, by) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id
              ? { ...g, current: Math.max(0, Math.min(g.target, g.current + by)) }
              : g
          ),
        })),

      deleteGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addTodo: (t) =>
        set((s) => {
          const sameDay = s.todos.filter((x) => x.date === t.date);
          const order = sameDay.length;
          return {
            todos: [
              ...s.todos,
              {
                id: uid(),
                title: t.title,
                done: false,
                date: t.date,
                goalId: t.goalId,
                notes: t.notes,
                priority: t.priority,
                order,
                recurringId: t.recurringId,
                time: t.time,
                durationMinutes: t.durationMinutes,
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }),

      toggleTodo: (id) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id
              ? {
                  ...t,
                  done: !t.done,
                  completedAt: !t.done ? new Date().toISOString() : undefined,
                }
              : t
          ),
        })),

      updateTodo: (id, patch) =>
        set((s) => ({
          todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      cyclePriority: (id) =>
        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id !== id) return t;
            const order: (Priority | undefined)[] = [
              undefined,
              "low",
              "med",
              "high",
            ];
            const idx = order.indexOf(t.priority);
            return { ...t, priority: order[(idx + 1) % order.length] };
          }),
        })),

      reorderTodos: (date, ids) =>
        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.date !== date) return t;
            const idx = ids.indexOf(t.id);
            return idx >= 0 ? { ...t, order: idx } : t;
          }),
        })),

      deleteTodo: (id) =>
        set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),

      upsertNote: (date, content) =>
        set((s) => {
          const existing = s.notes.find((n) => n.date === date);
          const now = new Date().toISOString();
          if (existing) {
            return {
              notes: s.notes.map((n) =>
                n.id === existing.id ? { ...n, content, updatedAt: now } : n
              ),
            };
          }
          return {
            notes: [
              ...s.notes,
              { id: uid(), date, content, createdAt: now, updatedAt: now },
            ],
          };
        }),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addEvent: (e) =>
        set((s) => ({
          events: [
            ...s.events,
            {
              id: uid(),
              title: e.title,
              date: e.date,
              time: e.time,
              durationMinutes: e.durationMinutes,
              goalId: e.goalId,
              color: e.color,
            },
          ],
        })),

      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      addRule: (r) =>
        set((s) => ({
          rules: [
            ...s.rules,
            { ...r, id: uid(), archived: false },
          ],
        })),

      deleteRule: (id) =>
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
          todos: s.todos.filter((t) => t.recurringId !== id),
        })),

      materializeForDate: (date) => {
        const s = get();
        const needed = s.rules.filter((r) => ruleMatches(r, date));
        const existingIds = new Set(
          s.todos.filter((t) => t.date === date).map((t) => t.recurringId)
        );
        const toAdd: Todo[] = [];
        let order = s.todos.filter((t) => t.date === date).length;
        for (const r of needed) {
          if (existingIds.has(r.id)) continue;
          toAdd.push({
            id: uid(),
            title: r.title,
            done: false,
            date,
            goalId: r.goalId,
            priority: r.priority,
            order: order++,
            recurringId: r.id,
            createdAt: new Date().toISOString(),
          });
        }
        if (toAdd.length > 0) {
          set({ todos: [...s.todos, ...toAdd] });
        }
      },

      addHabit: (h) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: uid(),
              title: h.title,
              emoji: h.emoji,
              color: h.color ?? GOAL_COLORS[s.habits.length % GOAL_COLORS.length],
              archived: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      deleteHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          habitChecks: s.habitChecks.filter((c) => c.habitId !== id),
        })),

      toggleHabit: (habitId, date) =>
        set((s) => {
          const existing = s.habitChecks.find(
            (c) => c.habitId === habitId && c.date === date
          );
          if (existing) {
            return {
              habitChecks: s.habitChecks.filter(
                (c) => !(c.habitId === habitId && c.date === date)
              ),
            };
          }
          return {
            habitChecks: [...s.habitChecks, { habitId, date }],
          };
        }),

      setMood: (date, score, note) =>
        set((s) => {
          const existing = s.moods.find((m) => m.date === date);
          if (existing) {
            return {
              moods: s.moods.map((m) =>
                m.date === date ? { ...m, score, note } : m
              ),
            };
          }
          return { moods: [...s.moods, { date, score, note }] };
        }),

      addFocusSession: (durationMinutes) =>
        set((s) => ({
          focus: [
            ...s.focus,
            {
              id: uid(),
              date: toDateKey(new Date()),
              durationMinutes,
              completedAt: new Date().toISOString(),
            },
          ],
        })),

      addSticky: (n) =>
        set((s) => ({
          stickies: [
            ...s.stickies,
            {
              id: uid(),
              title: n.title,
              content: n.content,
              color: n.color ?? GOAL_COLORS[s.stickies.length % GOAL_COLORS.length],
              x: n.x ?? Math.floor(Math.random() * 200),
              y: n.y ?? Math.floor(Math.random() * 200),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),

      updateSticky: (id, patch) =>
        set((s) => ({
          stickies: s.stickies.map((n) =>
            n.id === id
              ? { ...n, ...patch, updatedAt: new Date().toISOString() }
              : n
          ),
        })),

      deleteSticky: (id) =>
        set((s) => ({ stickies: s.stickies.filter((n) => n.id !== id) })),

      clearStickies: () => set({ stickies: [] }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      exportData: () => JSON.stringify(get(), null, 2),

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            goals: data.goals ?? [],
            todos: data.todos ?? [],
            notes: data.notes ?? [],
            events: data.events ?? [],
            rules: data.rules ?? [],
            habits: data.habits ?? [],
            habitChecks: data.habitChecks ?? [],
            moods: data.moods ?? [],
            focus: data.focus ?? [],
            settings: data.settings ?? { soundEnabled: true },
          });
          return true;
        } catch {
          return false;
        }
      },

      clearAll: () =>
        set({
          goals: [],
          todos: [],
          notes: [],
          events: [],
          rules: [],
          habits: [],
          habitChecks: [],
          moods: [],
          focus: [],
          stickies: [],
        }),
    }),
    { name: "life-os-store" }
  )
);

export function useTodosFor(date: string) {
  return useStore(
    useShallow((s) =>
      s.todos
        .filter((t) => t.date === date)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    )
  );
}

export function useNoteFor(date: string) {
  return useStore((s) => s.notes.find((n) => n.date === date));
}

export function useEventsFor(date: string) {
  return useStore(useShallow((s) => s.events.filter((e) => e.date === date)));
}

export function useMoodFor(date: string) {
  return useStore((s) => s.moods.find((m) => m.date === date));
}

export function useHabitChecks(date: string) {
  return useStore(
    useShallow((s) => s.habitChecks.filter((c) => c.date === date))
  );
}

export function useStreak(): number {
  return useStore((s) => {
    const byDate = new Map<string, { total: number; done: number }>();
    for (const t of s.todos) {
      const entry = byDate.get(t.date) ?? { total: 0, done: 0 };
      entry.total++;
      if (t.done) entry.done++;
      byDate.set(t.date, entry);
    }
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = toDateKey(d);
      const entry = byDate.get(key);
      if (!entry || entry.done === 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  });
}

export function useHabitStreak(habitId: string): number {
  return useStore((s) => {
    const dates = new Set(
      s.habitChecks.filter((c) => c.habitId === habitId).map((c) => c.date)
    );
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = toDateKey(d);
      if (!dates.has(key)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  });
}
