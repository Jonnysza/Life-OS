import Anthropic from "@anthropic-ai/sdk";

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_goal",
    description:
      "Create a long-term goal to track. Use when the user describes an outcome (e.g. 'read 12 books', 'save $10k', 'run a marathon').",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title of the goal" },
        target: {
          type: "number",
          description: "Numeric target. Default 100 for percent-style goals.",
        },
        unit: {
          type: "string",
          description: "Unit of measure (e.g. 'books', 'lbs', '%', 'miles')",
        },
        due_date: {
          type: "string",
          description: "Optional YYYY-MM-DD deadline",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_habit",
    description:
      "Create a daily habit — a simple yes/no thing the user wants to do every day (e.g. 'meditate', 'drink 2L water', 'read 30 min').",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        emoji: { type: "string", description: "A single emoji representing the habit" },
      },
      required: ["title", "emoji"],
    },
  },
  {
    name: "create_recurring_rule",
    description:
      "Create a recurring task that auto-appears in the day's todo list on matching days. Use for repeating work like 'workout weekdays' or 'review goals every Sunday'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        pattern: {
          type: "string",
          enum: ["daily", "weekdays", "weekly"],
        },
        weekday: {
          type: "number",
          description:
            "Only for 'weekly' pattern. 0=Sun, 1=Mon, 2=Tue, ..., 6=Sat",
        },
        goal_title: {
          type: "string",
          description: "Optional: title of an existing goal to link this rule to",
        },
        priority: { type: "string", enum: ["low", "med", "high"] },
      },
      required: ["title", "pattern"],
    },
  },
  {
    name: "create_todo",
    description:
      "Create a one-off todo on a specific day. Use for non-recurring tasks (e.g. 'call dentist Thursday').",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        goal_title: { type: "string", description: "Optional existing goal" },
        priority: { type: "string", enum: ["low", "med", "high"] },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "create_event",
    description:
      "Create a calendar event on a specific day with an optional time.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: {
          type: "string",
          description: "Optional HH:mm (24-hour). Omit for all-day.",
        },
      },
      required: ["title", "date"],
    },
  },
];

export const AGENT_SYSTEM = `You are Life OS, the user's autonomous planning assistant. Your job: turn their intentions into a concrete, scheduled plan using the tools available.

Behavior:
- When the user describes ANY goal, intention, ambition, or area they want to improve, PROACTIVELY use tools to set them up. Don't just give advice.
- Decompose goals: create the goal itself, plus the daily habits / recurring tasks / scheduled events / one-off todos that actually lead there.
- Be concrete and aggressive: propose specific actions with dates, not vague suggestions. The user can decline what they don't want.
- Make reasonable assumptions. Don't ask the user 10 clarifying questions — just propose a plan they can adjust.
- Avoid duplicates: the user's current state is shown to you at the start of every turn. Don't re-create things that already exist.
- Brief in text. One or two sentences before tool calls. The tool calls themselves show the user what you're doing.

You will see the user's current state at the top of each turn inside <state> tags. Use it to inform your plan.`;
