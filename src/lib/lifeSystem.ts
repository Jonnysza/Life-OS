import type {
  BlueprintRoutineTemplate,
  LifeProfile,
  LifeSystemBlueprint,
  RoutineCategory,
  RoutineTemplate,
} from "./types";
import { fromDateKey, toDateKey } from "./utils";

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function cleanIdPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function addDays(dateKey: string, days: number): string {
  const d = fromDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function stableTemplateId(template: BlueprintRoutineTemplate): string {
  return [
    "tpl",
    cleanIdPart(template.category),
    cleanIdPart(template.title),
    cleanIdPart(template.phaseLabel ?? "base"),
    template.startDate,
    template.time.replace(":", ""),
  ]
    .filter(Boolean)
    .join("-");
}

function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return ALL_DAYS;
  const normalized = days
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return normalized.length ? Array.from(new Set(normalized)).sort() : ALL_DAYS;
}

function normalizeCategory(value: unknown): RoutineCategory {
  const text = String(value ?? "routine");
  if (
    text === "gym" ||
    text === "work" ||
    text === "meal" ||
    text === "research" ||
    text === "content" ||
    text === "networking" ||
    text === "reading" ||
    text === "sleep" ||
    text === "review" ||
    text === "routine"
  ) {
    return text;
  }
  return "routine";
}

function normalizeTime(value: unknown, fallback = "09:00") {
  const text = String(value ?? fallback);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

export function normalizeBlueprint(
  input: Record<string, unknown>,
  today = toDateKey(new Date())
): LifeSystemBlueprint {
  const rawTemplates = Array.isArray(input.templates) ? input.templates : [];
  const templates = rawTemplates
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item): BlueprintRoutineTemplate => {
      const startDate =
        typeof item.startDate === "string"
          ? item.startDate
          : typeof item.start_date === "string"
            ? item.start_date
            : today;
      const endDate =
        typeof item.endDate === "string"
          ? item.endDate
          : typeof item.end_date === "string"
            ? item.end_date
            : undefined;
      const phaseLabel =
        typeof item.phaseLabel === "string"
          ? item.phaseLabel
          : typeof item.phase_label === "string"
            ? item.phase_label
            : undefined;
      const duration =
        typeof item.durationMinutes === "number"
          ? item.durationMinutes
          : typeof item.duration_minutes === "number"
            ? item.duration_minutes
            : 30;

      return {
        id: typeof item.id === "string" ? item.id : undefined,
        title: String(item.title ?? "Untitled routine"),
        category: normalizeCategory(item.category),
        kind: item.kind === "event" ? "event" : "todo",
        time: normalizeTime(item.time),
        durationMinutes: Math.max(5, Math.min(600, Number(duration) || 30)),
        days: normalizeDays(item.days),
        startDate,
        endDate,
        notes: typeof item.notes === "string" ? item.notes : undefined,
        source: item.source === "user" || item.source === "example" ? item.source : "ai",
        phaseLabel,
      };
    });

  const rawProfile =
    input.profile && typeof input.profile === "object"
      ? (input.profile as Record<string, unknown>)
      : {};

  const profile: Partial<Omit<LifeProfile, "updatedAt">> = {
    wakeTime: typeof rawProfile.wakeTime === "string"
      ? rawProfile.wakeTime
      : typeof rawProfile.wake_time === "string"
        ? rawProfile.wake_time
        : undefined,
    sleepTargetMinHours:
      typeof rawProfile.sleepTargetMinHours === "number"
        ? rawProfile.sleepTargetMinHours
        : typeof rawProfile.sleep_target_min_hours === "number"
          ? rawProfile.sleep_target_min_hours
          : undefined,
    sleepTargetMaxHours:
      typeof rawProfile.sleepTargetMaxHours === "number"
        ? rawProfile.sleepTargetMaxHours
        : typeof rawProfile.sleep_target_max_hours === "number"
          ? rawProfile.sleep_target_max_hours
          : undefined,
    workDomains: Array.isArray(rawProfile.workDomains)
      ? rawProfile.workDomains.map(String)
      : Array.isArray(rawProfile.work_domains)
        ? rawProfile.work_domains.map(String)
        : undefined,
    cadence:
      rawProfile.cadence === "weekdays" || rawProfile.cadence === "daily"
        ? rawProfile.cadence
        : "daily",
  };

  return {
    name: typeof input.name === "string" ? input.name : "Life OS setup",
    summary:
      typeof input.summary === "string"
        ? input.summary
        : "A 30-day operating system for your goals, habits, and schedule.",
    profile,
    assumptions: Array.isArray(input.assumptions)
      ? input.assumptions.map(String)
      : [],
    materializeDays:
      typeof input.materializeDays === "number"
        ? input.materializeDays
        : typeof input.materialize_days === "number"
          ? input.materialize_days
          : 7,
    templates,
  };
}

export function toRoutineTemplate(
  template: BlueprintRoutineTemplate,
  nowIso = new Date().toISOString()
): RoutineTemplate {
  return {
    ...template,
    id: template.id ?? stableTemplateId(template),
    createdAt: template.createdAt ?? nowIso,
  };
}

export function templateMatchesDate(template: RoutineTemplate, dateKey: string) {
  if (dateKey < template.startDate) return false;
  if (template.endDate && dateKey > template.endDate) return false;
  const day = fromDateKey(dateKey).getDay();
  return template.days.includes(day);
}

export function exampleLifeSystemBlueprint(today = toDateKey(new Date())): LifeSystemBlueprint {
  const phase1End = addDays(today, 29);
  const phase2Start = addDays(today, 30);
  return {
    name: "5 AM Builder System",
    summary:
      "A ready-to-use 30-day system with early wake, gym, meals, three work blocks, research, networking, content creation, reading ramp, and a 7-9 hour sleep target.",
    profile: {
      wakeTime: "05:00",
      sleepTargetMinHours: 7,
      sleepTargetMaxHours: 9,
      workDomains: ["business", "creative", "coding", "operations"],
      cadence: "daily",
    },
    assumptions: [
      "Work blocks stay generic so you can choose business, creative, coding, or operations each day.",
      "Meals and review blocks are placed around the work so the day runs all the way to night without guesswork.",
      "Reading starts small for 30 days, then doubles automatically.",
      "Sleep target is protected with an evening wind-down block.",
    ],
    materializeDays: 7,
    templates: [
      {
        title: "Wake up and start the day",
        category: "routine",
        kind: "todo",
        time: "05:00",
        durationMinutes: 15,
        days: ALL_DAYS,
        startDate: today,
        notes: "No negotiation. Start the system.",
        source: "example",
      },
      {
        title: "Gym - weights and cardio",
        category: "gym",
        kind: "todo",
        time: "05:15",
        durationMinutes: 90,
        days: ALL_DAYS,
        startDate: today,
        notes: "Split the session between lifting and cardio.",
        source: "example",
      },
      {
        title: "Shower and breakfast",
        category: "meal",
        kind: "event",
        time: "06:45",
        durationMinutes: 30,
        days: ALL_DAYS,
        startDate: today,
        notes: "Recover, clean up, and eat a simple planned breakfast.",
        source: "example",
      },
      {
        title: "Reading warm-up",
        category: "reading",
        kind: "todo",
        time: "07:15",
        durationMinutes: 15,
        days: ALL_DAYS,
        startDate: today,
        endDate: phase1End,
        phaseLabel: "days 1-30",
        source: "example",
      },
      {
        title: "Reading warm-up",
        category: "reading",
        kind: "todo",
        time: "07:15",
        durationMinutes: 30,
        days: ALL_DAYS,
        startDate: phase2Start,
        phaseLabel: "day 31+",
        source: "example",
      },
      {
        title: "Daily planning and priority pick",
        category: "review",
        kind: "todo",
        time: "07:45",
        durationMinutes: 15,
        days: ALL_DAYS,
        startDate: today,
        notes: "Choose the one thing each work block must move forward.",
        source: "example",
      },
      {
        title: "Work block 1",
        category: "work",
        kind: "todo",
        time: "08:00",
        durationMinutes: 90,
        days: ALL_DAYS,
        startDate: today,
        notes: "Choose business, creative, coding, or operations.",
        source: "example",
      },
      {
        title: "Work block 2",
        category: "work",
        kind: "todo",
        time: "10:00",
        durationMinutes: 90,
        days: ALL_DAYS,
        startDate: today,
        notes: "Choose the highest-leverage work type.",
        source: "example",
      },
      {
        title: "Research sweep",
        category: "research",
        kind: "todo",
        time: "11:30",
        durationMinutes: 30,
        days: ALL_DAYS,
        startDate: today,
        notes: "Industry videos, forums, competitors, or notes that sharpen execution.",
        source: "example",
      },
      {
        title: "Lunch",
        category: "meal",
        kind: "event",
        time: "12:00",
        durationMinutes: 45,
        days: ALL_DAYS,
        startDate: today,
        notes: "Eat, reset, and avoid drifting into random scrolling.",
        source: "example",
      },
      {
        title: "Work block 3",
        category: "work",
        kind: "todo",
        time: "13:00",
        durationMinutes: 90,
        days: ALL_DAYS,
        startDate: today,
        notes: "Use this for execution, shipping, or operations.",
        source: "example",
      },
      {
        title: "Networking follow-ups",
        category: "networking",
        kind: "todo",
        time: "14:45",
        durationMinutes: 45,
        days: ALL_DAYS,
        startDate: today,
        notes: "DMs, emails, warm intros, comments, and relationship maintenance.",
        source: "example",
      },
      {
        title: "Content creation or shipping",
        category: "content",
        kind: "todo",
        time: "16:00",
        durationMinutes: 90,
        days: ALL_DAYS,
        startDate: today,
        notes: "Create a tangible asset: post, page, feature, offer, or draft.",
        source: "example",
      },
      {
        title: "Dinner",
        category: "meal",
        kind: "event",
        time: "18:30",
        durationMinutes: 45,
        days: ALL_DAYS,
        startDate: today,
        notes: "Simple meal, low friction, no chaos before wind-down.",
        source: "example",
      },
      {
        title: "Evening reading",
        category: "reading",
        kind: "todo",
        time: "19:30",
        durationMinutes: 30,
        days: ALL_DAYS,
        startDate: today,
        endDate: phase1End,
        phaseLabel: "days 1-30",
        source: "example",
      },
      {
        title: "Evening reading",
        category: "reading",
        kind: "todo",
        time: "19:30",
        durationMinutes: 60,
        days: ALL_DAYS,
        startDate: phase2Start,
        phaseLabel: "day 31+",
        source: "example",
      },
      {
        title: "Wind down for 7-9 hours sleep",
        category: "sleep",
        kind: "event",
        time: "20:30",
        durationMinutes: 90,
        days: ALL_DAYS,
        startDate: today,
        notes: "Protect the sleep target for a 5 AM wake-up.",
        source: "example",
      },
    ],
  };
}
