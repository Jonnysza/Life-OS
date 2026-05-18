import type { RecurringRule } from "./types";
import { fromDateKey } from "./utils";

export function ruleMatches(rule: RecurringRule, dateKey: string): boolean {
  if (rule.archived) return false;
  if (dateKey < rule.startDate) return false;
  const d = fromDateKey(dateKey);
  const dow = d.getDay();
  switch (rule.pattern) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      return dow === (rule.weekday ?? 0);
  }
}

export function patternLabel(rule: RecurringRule): string {
  switch (rule.pattern) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][rule.weekday ?? 0] + " weekly";
  }
}
