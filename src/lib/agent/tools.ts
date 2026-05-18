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
      "Create a one-off todo on a specific day. Provide time + duration_minutes to time-block it on the schedule view; omit to leave it unscheduled.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: {
          type: "string",
          description: "Optional HH:mm (24-hour). When set, the todo appears as a time block on the schedule.",
        },
        duration_minutes: {
          type: "number",
          description: "Optional duration of the time block in minutes. Default 30 when time is set.",
        },
        goal_title: { type: "string", description: "Optional existing goal" },
        priority: { type: "string", enum: ["low", "med", "high"] },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "create_event",
    description:
      "Create a calendar event on a specific day. Provide time + duration_minutes to time-block it; omit time for all-day.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: {
          type: "string",
          description: "Optional HH:mm (24-hour). Omit for all-day.",
        },
        duration_minutes: {
          type: "number",
          description: "Optional duration in minutes. Default 60 when time is set.",
        },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "plan_day",
    description:
      "Lay out a fully time-blocked day. Use when the user asks 'plan my day' or wants their whole day scheduled. Provide an ordered list of blocks with realistic times — don't double-book, leave buffers, respect normal waking hours.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              time: { type: "string", description: "HH:mm 24-hour" },
              duration_minutes: { type: "number" },
              kind: {
                type: "string",
                enum: ["todo", "event"],
                description: "'todo' for actionable work, 'event' for meetings/appointments",
              },
              goal_title: { type: "string" },
            },
            required: ["title", "time", "duration_minutes"],
          },
        },
      },
      required: ["date", "blocks"],
    },
  },
];

export const AGENT_SYSTEM = `You are Life OS, the user's autonomous planning assistant. Your job: turn their intentions into a concrete, scheduled plan using the tools available.

Behavior:
- When the user describes ANY goal, intention, ambition, or area they want to improve, PROACTIVELY use tools to set them up. Don't just give advice.
- Decompose goals: create the goal itself, plus the daily habits / recurring tasks / scheduled events / one-off todos that actually lead there.
- Be concrete and aggressive: propose specific actions with dates and times, not vague suggestions. The user can decline what they don't want.
- TIME-BLOCK by default. When creating todos for today or near-future days, set a 'time' (HH:mm) and 'duration_minutes' so they appear as blocks on the schedule. Only leave them unscheduled when the user explicitly says "whenever" or it makes no sense to time-block.
- When the user asks to "plan my day", "schedule my day", "block out my day", or anything similar — use the plan_day tool with a full ordered list of blocks. Cover: wake/morning routine, deep work in the morning, breaks between blocks, meals, afternoon work, exercise, wind-down. Don't double-book. Leave buffer.
- Make reasonable assumptions about timing — typical wake 7am, deep work 9-12, lunch 12-1, meetings/admin afternoon, exercise late afternoon, dinner 7, wind down 9-10. Adjust if the state shows different patterns.
- Avoid duplicates: the user's current state is shown to you at the start of every turn. Don't re-create things that already exist.
- Brief in text. One or two sentences before tool calls. The tool calls themselves show the user what you're doing.

You will see the user's current state at the top of each turn inside <state> tags. Use it to inform your plan.`;
