import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { AGENT_TOOLS, AGENT_SYSTEM } from "@/lib/agent/tools";

export const runtime = "nodejs";

type StateSnapshot = {
  today: string;
  selectedDate: string;
  goals: { title: string; current: number; target: number; unit: string; dueDate?: string }[];
  habits: { title: string; emoji: string }[];
  rules: { title: string; pattern: string; weekday?: number }[];
  todosToday: string[];
  streak: number;
};

function renderState(state: StateSnapshot): string {
  const goals = state.goals.length
    ? state.goals
        .map(
          (g) =>
            `- ${g.title} (${g.current}/${g.target} ${g.unit}${g.dueDate ? `, due ${g.dueDate}` : ""})`
        )
        .join("\n")
    : "  (none)";
  const habits = state.habits.length
    ? state.habits.map((h) => `- ${h.emoji} ${h.title}`).join("\n")
    : "  (none)";
  const rules = state.rules.length
    ? state.rules
        .map(
          (r) =>
            `- ${r.title} (${r.pattern}${r.weekday !== undefined ? ", weekday=" + r.weekday : ""})`
        )
        .join("\n")
    : "  (none)";
  const todos = state.todosToday.length
    ? state.todosToday.map((t) => `- ${t}`).join("\n")
    : "  (none)";

  return `<state today="${state.today}" selected_date="${state.selectedDate}" streak="${state.streak}">
GOALS:
${goals}

HABITS:
${habits}

RECURRING TASKS:
${rules}

TODAY'S TODOS:
${todos}
</state>`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart `npm run dev`.",
      },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic();
    const body = await req.json();
    const messages: Anthropic.MessageParam[] = body.messages ?? [];
    const state: StateSnapshot = body.state;

    const augmented = [...messages];
    const last = augmented[augmented.length - 1];
    if (last && last.role === "user" && state) {
      const existing = Array.isArray(last.content)
        ? last.content
        : [{ type: "text" as const, text: String(last.content) }];
      augmented[augmented.length - 1] = {
        role: "user",
        content: [
          { type: "text", text: renderState(state) },
          ...existing,
        ],
      };
    }

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: AGENT_SYSTEM,
      tools: AGENT_TOOLS,
      messages: augmented,
    });

    return NextResponse.json({
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof Anthropic.APIError ? err.status ?? 500 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
