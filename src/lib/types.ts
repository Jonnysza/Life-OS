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

export type Settings = {
  soundEnabled: boolean;
  themePreset?: ThemePreset | "custom";
  customAccent?: string;
  customAccent2?: string;
};

export const THEME_PRESETS: Record<
  ThemePreset,
  { label: string; accent: string; accent2: string }
> = {
  violet: { label: "Violet", accent: "#8b5cf6", accent2: "#6366f1" },
  blue: { label: "Blue", accent: "#2563eb", accent2: "#06b6d4" },
  green: { label: "Green", accent: "#10b981", accent2: "#84cc16" },
  rose: { label: "Rose", accent: "#e11d48", accent2: "#f97316" },
  amber: { label: "Amber", accent: "#d97706", accent2: "#facc15" },
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
