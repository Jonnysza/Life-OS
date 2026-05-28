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
  LifeProfile,
  LifeSystemBlueprint,
  RoutineTemplate,
} from "./types";
import { GOAL_COLORS } from "./types";
import { toDateKey, uid } from "./utils";
import { ruleMatches } from "./recurrence";
import {
  addDays,
  normalizeBlueprint,
  templateMatchesDate,
  toRoutineTemplate,
} from "./lifeSystem";

function sameScheduleTitle(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function hasTemplateDuplicate(
  todos: Todo[],
  events: CalEvent[],
  date: string,
  template: RoutineTemplate
) {
  return (
    todos.some(
      (t) =>
        t.date === date &&
        (t.templateId === template.id ||
          (t.time === template.time && sameScheduleTitle(t.title, template.title)))
    ) ||
    events.some(
      (e) =>
        e.date === date &&
        (e.templateId === template.id ||
          (e.time === template.time && sameScheduleTitle(e.title, template.title)))
    )
  );
}

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
  lifeProfile?: LifeProfile;
  routineTemplates: RoutineTemplate[];
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
  upsertGoogleEvents: (
    events: (Partial<CalEvent> & {
      title: string;
      date: string;
      externalId: string;
    })[]
  ) => void;
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
  applyLifeSystemBlueprint: (
    blueprint: LifeSystemBlueprint | Record<string, unknown>
  ) => { templates: number; scheduled: number; profile: boolean };
  materializeRoutineTemplates: (days?: number, startDate?: string) => number;
  deleteRoutineTemplate: (id: string) => void;
  clearLifeSystem: () => void;
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
      lifeProfile: undefined,
      routineTemplates: [],
      settings: { soundEnabled: true, themePreset: "violet" },
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
                templateId: t.templateId,
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
              source: e.source ?? "life-os",
              externalId: e.externalId,
              templateId: e.templateId,
            },
          ],
        })),

      upsertGoogleEvents: (incoming) =>
        set((s) => {
          const events = [...s.events];
          for (const item of incoming) {
            const idx = events.findIndex(
              (event) => event.externalId && event.externalId === item.externalId
            );
            const next: CalEvent = {
              id: idx >= 0 ? events[idx].id : uid(),
              title: item.title,
              date: item.date,
              time: item.time,
              durationMinutes: item.durationMinutes,
              goalId: item.goalId,
              color: item.color ?? "#4285f4",
              source: "google",
              externalId: item.externalId,
            };
            if (idx >= 0) events[idx] = { ...events[idx], ...next };
            else events.push(next);
          }
          return { events };
        }),

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

      applyLifeSystemBlueprint: (raw) => {
        const today = toDateKey(new Date());
        const blueprint = normalizeBlueprint(raw as Record<string, unknown>, today);
        const now = new Date().toISOString();
        const incoming = blueprint.templates.map((t) => toRoutineTemplate(t, now));
        let scheduled = 0;

        set((s) => {
          const templateMap = new Map(s.routineTemplates.map((t) => [t.id, t]));
          for (const template of incoming) {
            templateMap.set(template.id, {
              ...templateMap.get(template.id),
              ...template,
              createdAt: templateMap.get(template.id)?.createdAt ?? template.createdAt,
            });
          }

          const todos = [...s.todos];
          const events = [...s.events];
          const days = Math.max(1, Math.min(14, blueprint.materializeDays ?? 7));
          for (let offset = 0; offset < days; offset++) {
            const date = addDays(today, offset);
            let order = todos.filter((t) => t.date === date).length;
            for (const template of incoming) {
              if (!templateMatchesDate(template, date)) continue;
              if (hasTemplateDuplicate(todos, events, date, template)) continue;
              if (template.kind === "event") {
                events.push({
                  id: uid(),
                  title: template.title,
                  date,
                  time: template.time,
                  durationMinutes: template.durationMinutes,
                  color: undefined,
                  source: "life-os",
                  templateId: template.id,
                });
              } else {
                todos.push({
                  id: uid(),
                  title: template.title,
                  done: false,
                  date,
                  order: order++,
                  time: template.time,
                  durationMinutes: template.durationMinutes,
                  templateId: template.id,
                  notes: template.notes,
                  createdAt: now,
                });
              }
              scheduled++;
            }
          }

          return {
            lifeProfile: {
              ...(s.lifeProfile ?? { updatedAt: now }),
              ...blueprint.profile,
              updatedAt: now,
            },
            routineTemplates: Array.from(templateMap.values()).sort((a, b) =>
              a.time.localeCompare(b.time)
            ),
            todos,
            events,
          };
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("life-os:force-schedule-sync"));
        }
        return {
          templates: incoming.length,
          scheduled,
          profile: Boolean(blueprint.profile),
        };
      },

      materializeRoutineTemplates: (days = 7, startDate = toDateKey(new Date())) => {
        let scheduled = 0;
        const now = new Date().toISOString();
        set((s) => {
          const todos = [...s.todos];
          const events = [...s.events];
          for (let offset = 0; offset < Math.max(1, Math.min(14, days)); offset++) {
            const date = addDays(startDate, offset);
            let order = todos.filter((t) => t.date === date).length;
            for (const template of s.routineTemplates) {
              if (!templateMatchesDate(template, date)) continue;
              if (hasTemplateDuplicate(todos, events, date, template)) continue;
              if (template.kind === "event") {
                events.push({
                  id: uid(),
                  title: template.title,
                  date,
                  time: template.time,
                  durationMinutes: template.durationMinutes,
                  source: "life-os",
                  templateId: template.id,
                });
              } else {
                todos.push({
                  id: uid(),
                  title: template.title,
                  done: false,
                  date,
                  order: order++,
                  time: template.time,
                  durationMinutes: template.durationMinutes,
                  templateId: template.id,
                  notes: template.notes,
                  createdAt: now,
                });
              }
              scheduled++;
            }
          }
          return scheduled > 0 ? { todos, events } : {};
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("life-os:force-schedule-sync"));
        }
        return scheduled;
      },

      deleteRoutineTemplate: (id) =>
        set((s) => ({
          routineTemplates: s.routineTemplates.filter((t) => t.id !== id),
        })),

      clearLifeSystem: () =>
        set({
          lifeProfile: undefined,
          routineTemplates: [],
        }),

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
            stickies: data.stickies ?? [],
            lifeProfile: data.lifeProfile,
            routineTemplates: data.routineTemplates ?? [],
            settings: {
              soundEnabled: data.settings?.soundEnabled ?? true,
              themePreset: data.settings?.themePreset ?? "violet",
              customAccent: data.settings?.customAccent,
              customAccent2: data.settings?.customAccent2,
            },
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
          lifeProfile: undefined,
          routineTemplates: [],
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
