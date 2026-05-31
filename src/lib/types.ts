export type Priority = "low" | "med" | "high";

export type Goal = {
  id: string;
  title: string;
  description?: string;
  target: number;
  current: number;
  unit: string;
  dueDate?: string;
  color: string;
  archived: boolean;
  createdAt: string;
};

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  date: string;
  goalId?: string;
  notes?: string;
  priority?: Priority;
  order?: number;
  recurringId?: string;
  time?: string;
  durationMinutes?: number;
  templateId?: string;
  createdAt: string;
  completedAt?: string;
};

export type Note = {
  id: string;
  content: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type CalEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  goalId?: string;
  color?: string;
  source?: "google" | "life-os";
  externalId?: string;
  templateId?: string;
};

export type RecurrencePattern = "daily" | "weekdays" | "weekly";

export type RecurringRule = {
  id: string;
  title: string;
  pattern: RecurrencePattern;
  weekday?: number;
  goalId?: string;
  priority?: Priority;
  startDate: string;
  archived: boolean;
};

export type Habit = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  createdAt: string;
  archived: boolean;
};

export type HabitCheck = {
  habitId: string;
  date: string;
};

export type Mood = {
  date: string;
  score: 1 | 2 | 3 | 4 | 5;
  note?: string;
};

export type FocusSession = {
  id: string;
  date: string;
  durationMinutes: number;
  completedAt: string;
};

export type ThemePreset = "violet" | "blue" | "green" | "rose" | "amber";

export type DashboardTheme = {
  label: string;
  background: string;
  surface: string;
  surface2: string;
  border: string;
  foreground: string;
  muted: string;
  accent: string;
  accent2: string;
  success: string;
  danger: string;
};

export type Settings = {
  soundEnabled: boolean;
  themePreset?: ThemePreset | "custom";
  customAccent?: string;
  customAccent2?: string;
};

export const THEME_PRESETS: Record<ThemePreset, DashboardTheme> = {
  violet: {
    label: "Violet",
    background: "#0a0a0f",
    surface: "#12121a",
    surface2: "#1a1a25",
    border: "#26262f",
    foreground: "#f0f0f5",
    muted: "#8a8a99",
    accent: "#8b5cf6",
    accent2: "#6366f1",
    success: "#10b981",
    danger: "#f43f5e",
  },
  blue: {
    label: "Blue",
    background: "#071018",
    surface: "#0d1722",
    surface2: "#142234",
    border: "#243449",
    foreground: "#eef7ff",
    muted: "#8aa2b8",
    accent: "#2563eb",
    accent2: "#06b6d4",
    success: "#22c55e",
    danger: "#f43f5e",
  },
  green: {
    label: "Green",
    background: "#07130f",
    surface: "#0e1b17",
    surface2: "#172821",
    border: "#284038",
    foreground: "#effaf5",
    muted: "#8fa79b",
    accent: "#10b981",
    accent2: "#84cc16",
    success: "#22c55e",
    danger: "#fb7185",
  },
  rose: {
    label: "Rose",
    background: "#14090f",
    surface: "#1e1118",
    surface2: "#2b1822",
    border: "#442738",
    foreground: "#fff2f7",
    muted: "#b193a1",
    accent: "#e11d48",
    accent2: "#f97316",
    success: "#34d399",
    danger: "#fb7185",
  },
  amber: {
    label: "Amber",
    background: "#12100a",
    surface: "#1b1710",
    surface2: "#282114",
    border: "#40341f",
    foreground: "#fff8eb",
    muted: "#aa9a7c",
    accent: "#d97706",
    accent2: "#facc15",
    success: "#22c55e",
    danger: "#ef4444",
  },
};

export type StickyNote = {
  id: string;
  title?: string;
  content: string;
  color: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
};

export type RoutineCategory =
  | "gym"
  | "work"
  | "meal"
  | "research"
  | "content"
  | "networking"
  | "reading"
  | "sleep"
  | "routine"
  | "review";

export type LifeProfile = {
  wakeTime?: string;
  sleepTargetMinHours?: number;
  sleepTargetMaxHours?: number;
  workDomains?: string[];
  cadence?: "daily" | "weekdays";
  updatedAt: string;
};

export type RoutineTemplate = {
  id: string;
  title: string;
  category: RoutineCategory;
  kind: "todo" | "event";
  time: string;
  durationMinutes: number;
  days: number[];
  startDate: string;
  endDate?: string;
  notes?: string;
  source: "ai" | "user" | "example";
  phaseLabel?: string;
  createdAt: string;
};

export type BlueprintRoutineTemplate = Omit<
  RoutineTemplate,
  "id" | "createdAt"
> & {
  id?: string;
  createdAt?: string;
};

export type LifeSystemBlueprint = {
  name?: string;
  summary: string;
  profile?: Partial<Omit<LifeProfile, "updatedAt">>;
  assumptions?: string[];
  materializeDays?: number;
  templates: BlueprintRoutineTemplate[];
};

export const GOAL_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
];

export const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: "#06b6d4",
  med: "#f97316",
  high: "#f43f5e",
};
