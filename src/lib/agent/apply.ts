"use client";

import { useStore } from "@/lib/store";
import { toDateKey } from "@/lib/utils";
import { addDays } from "@/lib/lifeSystem";
import type { Priority, RecurrencePattern } from "@/lib/types";

type AnyInput = Record<string, unknown>;

function sameBlockTitle(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function hasSameScheduledBlock(date: string, title: string, time?: string) {
  if (!time) return false;
  const s = useStore.getState();
  return (
    s.todos.some(
      (t) => t.date === date && t.time === time && sameBlockTitle(t.title, title)
    ) ||
    s.events.some(
      (e) => e.date === date && e.time === time && sameBlockTitle(e.title, title)
    )
  );
}

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
      const time = typeof input.time === "string" ? input.time : undefined;
      const duration =
        typeof input.duration_minutes === "number"
          ? input.duration_minutes
          : time
            ? 30
            : undefined;
      if (hasSameScheduledBlock(date, title, time)) {
        return `Skipped duplicate "${title}" at ${time} for ${date}.`;
      }
      s.addTodo({
        title,
        date,
        goalId: goal?.id,
        priority:
          typeof input.priority === "string"
            ? (input.priority as Priority)
            : undefined,
        time,
        durationMinutes: duration,
      });
      return `Added todo "${title}"${time ? ` at ${time}` : ""} for ${date}.`;
    }

    case "create_event": {
      const title = String(input.title ?? "Untitled event");
      const date =
        typeof input.date === "string" ? input.date : toDateKey(new Date());
      const time = typeof input.time === "string" ? input.time : undefined;
      const duration =
        typeof input.duration_minutes === "number"
          ? input.duration_minutes
          : time
            ? 60
            : undefined;
      if (hasSameScheduledBlock(date, title, time)) {
        return `Skipped duplicate "${title}" at ${time} for ${date}.`;
      }
      s.addEvent({ title, date, time, durationMinutes: duration });
      return `Added event "${title}" on ${date}${time ? " at " + time : ""}.`;
    }

    case "plan_day": {
      const date =
        typeof input.date === "string" ? input.date : toDateKey(new Date());
      const blocks = Array.isArray(input.blocks) ? input.blocks : [];
      let added = 0;
      for (const b of blocks) {
        if (typeof b !== "object" || !b) continue;
        const block = b as Record<string, unknown>;
        const title = String(block.title ?? "");
        const time = String(block.time ?? "");
        const dur = Number(block.duration_minutes ?? 30);
        if (!title || !time) continue;
        const kind = block.kind === "event" ? "event" : "todo";
        if (hasSameScheduledBlock(date, title, time)) continue;
        const goalTitle =
          typeof block.goal_title === "string" ? block.goal_title : undefined;
        const goal = goalTitle
          ? s.goals.find(
              (g) => g.title.toLowerCase() === goalTitle.toLowerCase()
            )
          : undefined;
        if (kind === "event") {
          s.addEvent({ title, date, time, durationMinutes: dur, goalId: goal?.id });
        } else {
          s.addTodo({
            title,
            date,
            time,
            durationMinutes: dur,
            goalId: goal?.id,
          });
        }
        added++;
      }
      return `Scheduled ${added} block${added === 1 ? "" : "s"} for ${date}.`;
    }

    case "build_life_system": {
      const result = s.applyLifeSystemBlueprint(input);
      return `Applied life system: ${result.templates} routine template${result.templates === 1 ? "" : "s"}, ${result.scheduled} scheduled block${result.scheduled === 1 ? "" : "s"} created for the next 7 days. Timed blocks are now eligible for push reminders, the live calendar feed, and direct Google Calendar sync if connected.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export function buildStateSnapshot() {
  const s = useStore.getState();
  const today = toDateKey(new Date());
  const nextSeven = new Set(
    Array.from({ length: 7 }, (_, idx) => addDays(today, idx))
  );
  const todosToday = s.todos
    .filter((t) => t.date === today)
    .map(
      (t) =>
        `${t.done ? "[x]" : "[ ]"} ${t.title}${t.time ? ` at ${t.time}${t.durationMinutes ? ` (${t.durationMinutes}m)` : ""}` : " (unscheduled)"}`
    );
  const upcomingSchedule = [
    ...s.todos
      .filter((t) => t.time && nextSeven.has(t.date))
      .map((t) => ({
        date: t.date,
        time: t.time as string,
        title: t.title,
        durationMinutes: t.durationMinutes,
        kind: "todo" as const,
        done: t.done,
        templateId: t.templateId,
      })),
    ...s.events
      .filter((e) => e.time && nextSeven.has(e.date))
      .map((e) => ({
        date: e.date,
        time: e.time as string,
        title: e.title,
        durationMinutes: e.durationMinutes,
        kind: "event" as const,
        source: e.source,
        templateId: e.templateId,
      })),
  ]
    .sort((a, b) =>
      `${a.date} ${a.time} ${a.title}`.localeCompare(`${b.date} ${b.time} ${b.title}`)
    )
    .slice(0, 80);
  const timedReminderCount =
    s.todos.filter((t) => t.time && !t.done && nextSeven.has(t.date)).length +
    s.events.filter((e) => e.time && e.source !== "google" && nextSeven.has(e.date)).length;
  return {
    today,
    selectedDate: s.selectedDate,
    lifeProfile: s.lifeProfile
      ? {
          wakeTime: s.lifeProfile.wakeTime,
          sleepTargetMinHours: s.lifeProfile.sleepTargetMinHours,
          sleepTargetMaxHours: s.lifeProfile.sleepTargetMaxHours,
          workDomains: s.lifeProfile.workDomains,
          cadence: s.lifeProfile.cadence,
        }
      : undefined,
    routineTemplates: s.routineTemplates.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      kind: t.kind,
      time: t.time,
      durationMinutes: t.durationMinutes,
      days: t.days,
      startDate: t.startDate,
      endDate: t.endDate,
      phaseLabel: t.phaseLabel,
    })),
    upcomingSchedule,
    timedReminderCount,
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
