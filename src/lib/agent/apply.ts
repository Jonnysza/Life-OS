"use client";

import { useStore } from "@/lib/store";
import { toDateKey } from "@/lib/utils";
import type { Priority, RecurrencePattern } from "@/lib/types";

type AnyInput = Record<string, unknown>;

export function applyToolCall(name: string, input: AnyInput): string {
  const s = useStore.getState();

  switch (name) {
    case "create_goal": {
      const title = String(input.title ?? "Untitled goal");
      s.addGoal({
        title,
        target: typeof input.target === "number" ? input.target : 100,
        unit: typeof input.unit === "string" ? input.unit : "%",
        dueDate: typeof input.due_date === "string" ? input.due_date : undefined,
      });
      return `Created goal "${title}".`;
    }

    case "create_habit": {
      const title = String(input.title ?? "Untitled habit");
      const emoji = typeof input.emoji === "string" ? input.emoji : "✨";
      s.addHabit({ title, emoji });
      return `Created habit "${emoji} ${title}".`;
    }

    case "create_recurring_rule": {
      const title = String(input.title ?? "Untitled task");
      const pattern = (input.pattern as RecurrencePattern) ?? "daily";
      const goalTitle =
        typeof input.goal_title === "string" ? input.goal_title : undefined;
      const goal = goalTitle
        ? s.goals.find(
            (g) => g.title.toLowerCase() === goalTitle.toLowerCase()
          )
        : undefined;
      s.addRule({
        title,
        pattern,
        weekday:
          pattern === "weekly" && typeof input.weekday === "number"
            ? input.weekday
            : undefined,
        goalId: goal?.id,
        priority:
          typeof input.priority === "string"
            ? (input.priority as Priority)
            : undefined,
        startDate: toDateKey(new Date()),
      });
      useStore.getState().materializeForDate(useStore.getState().selectedDate);
      return `Created recurring task "${title}" (${pattern}).`;
    }

    case "create_todo": {
      const title = String(input.title ?? "Untitled todo");
      const date =
        typeof input.date === "string" ? input.date : toDateKey(new Date());
      const goalTitle =
        typeof input.goal_title === "string" ? input.goal_title : undefined;
      const goal = goalTitle
        ? s.goals.find(
            (g) => g.title.toLowerCase() === goalTitle.toLowerCase()
          )
        : undefined;
      s.addTodo({
        title,
        date,
        goalId: goal?.id,
        priority:
          typeof input.priority === "string"
            ? (input.priority as Priority)
            : undefined,
      });
      return `Added todo "${title}" for ${date}.`;
    }

    case "create_event": {
      const title = String(input.title ?? "Untitled event");
      const date =
        typeof input.date === "string" ? input.date : toDateKey(new Date());
      const time = typeof input.time === "string" ? input.time : undefined;
      s.addEvent({ title, date, time });
      return `Added event "${title}" on ${date}${time ? " at " + time : ""}.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export function buildStateSnapshot() {
  const s = useStore.getState();
  const today = toDateKey(new Date());
  const todosToday = s.todos
    .filter((t) => t.date === today)
    .map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`);
  return {
    today,
    selectedDate: s.selectedDate,
    goals: s.goals.map((g) => ({
      title: g.title,
      current: g.current,
      target: g.target,
      unit: g.unit,
      dueDate: g.dueDate,
    })),
    habits: s.habits.map((h) => ({ title: h.title, emoji: h.emoji })),
    rules: s.rules.map((r) => ({
      title: r.title,
      pattern: r.pattern,
      weekday: r.weekday,
    })),
    todosToday,
    streak: (() => {
      const byDate = new Map<string, { d: number; t: number }>();
      for (const t of s.todos) {
        const e = byDate.get(t.date) ?? { d: 0, t: 0 };
        e.t++;
        if (t.done) e.d++;
        byDate.set(t.date, e);
      }
      let streak = 0;
      const d = new Date();
      while (true) {
        const key = toDateKey(d);
        const e = byDate.get(key);
        if (!e || e.d === 0) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    })(),
  };
}
