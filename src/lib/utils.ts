import { format, parseISO } from "date-fns";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromDateKey(s: string): Date {
  return parseISO(s);
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function prettyDate(s: string): string {
  return format(parseISO(s), "EEEE, MMM d");
}

export function shortDate(s: string): string {
  return format(parseISO(s), "MMM d");
}
