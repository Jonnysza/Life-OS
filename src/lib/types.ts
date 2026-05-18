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

export type Settings = {
  soundEnabled: boolean;
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
