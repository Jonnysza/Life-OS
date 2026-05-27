import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { AGENT_TOOLS, AGENT_SYSTEM } from "@/lib/agent/tools";

export const runtime = "nodejs";

const PRIMARY_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const FALLBACK_MODELS = (process.env.ANTHROPIC_FALLBACK_MODELS || "claude-haiku-4-5")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableAnthropicError(e: unknown) {
  if (!(e instanceof Anthropic.APIError)) return false;
  return e.status === 408 || e.status === 409 || e.status === 429 || e.status === 500 || e.status === 502 || e.status === 503 || e.status === 529;
}

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
    const client = new Anthropic({ maxRetries: 4 });
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

    async function call(model: string) {
      return client.messages.create({
        model,
        max_tokens: 4096,
        system: AGENT_SYSTEM,
        tools: AGENT_TOOLS,
        messages: augmented,
      });
    }

    const models = [PRIMARY_MODEL, ...FALLBACK_MODELS].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );
    let response;
    let lastRetryableError: unknown;

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await call(model);
          break;
        } catch (e) {
          if (!retryableAnthropicError(e)) throw e;
          lastRetryableError = e;
          await sleep(500 + attempt * 900);
        }
      }
      if (response) break;
    }

    if (!response && lastRetryableError) {
      return NextResponse.json({
        content: [
          {
            type: "text",
            text:
              "Claude is temporarily overloaded. I saved your message in this chat, but I could not get a reliable planning response yet. Tap Send again in a moment, or try a shorter request like: \"Plan today around my top 3 tasks.\"",
          },
        ],
        stop_reason: "end_turn",
        retryable: true,
      });
    }

    if (!response) throw new Error("No AI response returned.");

    return NextResponse.json({
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof Anthropic.APIError ? err.status ?? 500 : 500;
    const publicMsg =
      status === 401
        ? "The AI key is invalid or missing in Vercel settings."
        : status === 400
          ? "The AI could not read that conversation state. I reset unsafe tool state; try sending the message again."
          : msg;
    return NextResponse.json({ error: publicMsg }, { status });
  }
}
