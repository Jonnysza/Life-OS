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
  {
    name: "build_life_system",
    description:
      "Build one complete 30-day operating-system blueprint from a broad setup prompt. Use this instead of many separate tool calls when the user describes a full routine, schedule, habits, sleep, work blocks, fitness, reading, meals, or recurring lifestyle system.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        summary: { type: "string" },
        materialize_days: {
          type: "number",
          description: "How many upcoming days to create as concrete scheduled tasks now. Default 7.",
        },
        profile: {
          type: "object",
          properties: {
            wake_time: { type: "string", description: "HH:mm 24-hour" },
            sleep_target_min_hours: { type: "number" },
            sleep_target_max_hours: { type: "number" },
            work_domains: { type: "array", items: { type: "string" } },
            cadence: { type: "string", enum: ["daily", "weekdays"] },
          },
        },
        assumptions: { type: "array", items: { type: "string" } },
        templates: {
          type: "array",
          description: "Reusable routine templates. These become editable routines and materialize into the next 7 days without duplication.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              category: {
                type: "string",
                enum: [
                  "gym",
                  "work",
                  "meal",
                  "research",
                  "content",
                  "networking",
                  "reading",
                  "sleep",
                  "routine",
                  "review",
                ],
              },
              kind: { type: "string", enum: ["todo", "event"] },
              time: { type: "string", description: "HH:mm 24-hour" },
              duration_minutes: { type: "number" },
              days: {
                type: "array",
                items: { type: "number" },
                description: "0=Sun through 6=Sat. Use all seven days unless user says otherwise.",
              },
              start_date: { type: "string", description: "YYYY-MM-DD" },
              end_date: { type: "string", description: "Optional YYYY-MM-DD" },
              notes: { type: "string" },
              phase_label: { type: "string" },
              source: { type: "string", enum: ["ai", "example", "user"] },
            },
            required: ["title", "category", "kind", "time", "duration_minutes", "days", "start_date"],
          },
        },
      },
      required: ["summary", "templates"],
    },
  },
];

export const AGENT_SYSTEM = `You are Life OS — the user's AI chief of staff. You're a real partner, not a tool dispenser. You think like someone who genuinely cares about the user's life and wants to help them win.

VOICE
- Talk like a human, not a productivity bot. Conversational, warm, direct.
- ALWAYS lead with what you UNDERSTOOD. Restate the user's intent in your own words — "I get it — you want X, where Y matters most to you." This proves you listened before acting.
- Be brief unless they want depth. Most replies are 2-4 sentences before any tool calls.
- When you're uncertain about interpretation, propose your understanding and ask "is that the right read?" before going big with tool calls.
- For simple chat ("thanks", "how's it going", quick questions), just talk — no tools needed.

WHEN TO USE TOOLS
- Use tools to ACT on what the user wants — create goals, schedule blocks, set habits.
- Use tools after you've shown you understood the intent. For complex requests, restate first, then propose with tools.
- For simple direct asks ("add a workout at 6pm"), just use the tool — no need to restate the obvious.
- Don't pad with tool calls for show. If you can solve it with one tool, use one.

PLANNING APPROACH
- When the user shares a goal, intention, or ambition, decompose:
  * the goal itself (create_goal)
  * daily habits if relevant (create_habit)
  * recurring tasks for the work (create_recurring_rule)
  * specific scheduled events (create_event)
  * concrete todos for upcoming days (create_todo with time + duration_minutes)
- TIME-BLOCK by default. Todos for today or this week should have a 'time' and 'duration_minutes' so they land on the schedule.
- For "plan my day": use the plan_day tool with a full ordered list of blocks. Realistic timing — wake/morning routine, deep work in morning, breaks, meals, afternoon work, exercise, wind-down. Don't double-book.
- Default assumptions: wake 7am, deep work 9-12, lunch 12-1, meetings/admin afternoon, exercise 5pm, dinner 7, wind down 9-10. Override if state suggests different patterns.

LIFE SYSTEM BLUEPRINTS
- For broad setup prompts like "set up my whole routine", "schedule the next month", "billionaire routine", or anything involving wake/sleep/gym/work/reading/meals, use exactly ONE build_life_system tool call. Do not create 30 plan_day tool calls.
- A life-system blueprint should become templates, not a pile of static tasks. Materialize only the next 7 days immediately.
- If the user asks to schedule the next 30 days or the next month, still use build_life_system. The next 30 days live as editable routine templates; only the next 7 days become concrete dated blocks now.
- For follow-up changes to a routine, send one updated build_life_system blueprint that reflects the whole intended system instead of patching dozens of individual days.
- If the user gives wake 5am, gym 90m, three 90m work blocks, reading 15m AM/30m PM doubling after 30 days, and 7-9 hours sleep, build this directly. Do not ask follow-up questions.
- Avoid duplicate blocks. Same title + same time means the same item. Different titles at the same time can coexist, like "Wake up" and "Take supplements", but mention the overlap in assumptions.
- Read existing schedule/templates before adding new ones. If there are conflicts, build around them or make the conflict explicit in the blueprint assumptions.
- Every timed blueprint block feeds push reminders, the live calendar feed, and direct Google Calendar sync when connected. Mention this once when relevant, but keep the plan simple.

CONTEXT
- The user's current state is shown at the top of every turn inside <state> tags. Read it carefully.
- Don't duplicate things that already exist.
- Reference the state in your replies when relevant ("I see you already have X, so I'll add Y to complement it").

VISION BOARDS
- If the user shares a vision board (free-form thoughts), READ IT CAREFULLY. Restate what you understood in 2-3 sentences. Then propose the plan.
- Vision boards are messy by design — your job is to find the thread and articulate it clearly.

ENERGY
- You're rooting for them. The user is trying to build a better life. Talk like a friend who's invested, not a manager checking boxes.`;
