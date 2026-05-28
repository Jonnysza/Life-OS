"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Sparkles,
  Send,
  Target,
  Repeat,
  ListChecks,
  CalendarPlus,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { applyToolCall, buildStateSnapshot } from "@/lib/agent/apply";
import { exampleLifeSystemBlueprint, normalizeBlueprint } from "@/lib/lifeSystem";
import type { BlueprintRoutineTemplate } from "@/lib/types";
import { useUIStore } from "@/lib/uiStore";

type TextBlock = { type: "text"; text: string };
type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

type Message = {
  role: "user" | "assistant";
  content: ContentBlock[];
  appliedToolIds?: Set<string>;
};

const QUICK_ACTIONS = [
  {
    label: "Set up my life system",
    prompt:
      "Set up my full life system from my current goals and schedule. Use one build_life_system blueprint, make assumptions explicit, avoid duplicates, and make timed blocks reminder-backed and Google Calendar-ready.",
  },
  {
    label: "Guide me",
    prompt:
      "Guide me through Life OS in the simplest possible way: notifications, tasks, schedule, AI setup, and Google Calendar sync. Tell me what to click and what matters.",
  },
  { label: "Time-block my day", prompt: "Use the plan_day tool to lay out a fully time-blocked day for today based on my goals, habits, and pending todos. Use realistic times — wake/wind-down buffers, deep work in the morning, breaks between blocks, exercise, meals. Don't double-book." },
  { label: "Plan my week", prompt: "Look at my goals and propose what I should focus on this week. Use plan_day for today and create_todo with time/duration for the rest of the week's key blocks." },
  { label: "New goal", prompt: "I want to set up a new goal. Ask me what it is, then propose a full plan with the goal, habits, and recurring tasks." },
  { label: "What's next?", prompt: "Look at my goals and what I've done recently. Propose the highest-leverage next 3 things I should add to my plan." },
];

const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  create_goal: Target,
  create_habit: Repeat,
  create_recurring_rule: Repeat,
  create_todo: ListChecks,
  create_event: CalendarPlus,
  plan_day: CalendarPlus,
  build_life_system: Sparkles,
};

const TOOL_LABELS: Record<string, string> = {
  create_goal: "New goal",
  create_habit: "New habit",
  create_recurring_rule: "Recurring task",
  create_todo: "New todo",
  create_event: "New event",
  plan_day: "Time-blocked day",
  build_life_system: "Life system blueprint",
};

function minutesFor(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function dateRangesOverlap(
  a: BlueprintRoutineTemplate,
  b: BlueprintRoutineTemplate
) {
  const aEnd = a.endDate ?? "9999-12-31";
  const bEnd = b.endDate ?? "9999-12-31";
  return a.startDate <= bEnd && b.startDate <= aEnd;
}

function daysOverlap(a: BlueprintRoutineTemplate, b: BlueprintRoutineTemplate) {
  const bDays = new Set(b.days);
  return a.days.some((day) => bDays.has(day));
}

function sameTitle(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function blueprintNotices(templates: BlueprintRoutineTemplate[]) {
  const notices: string[] = [];
  const sorted = [...templates].sort((a, b) => a.time.localeCompare(b.time));

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (!dateRangesOverlap(a, b) || !daysOverlap(a, b)) continue;

      const aStart = minutesFor(a.time);
      const bStart = minutesFor(b.time);
      const overlaps =
        Math.max(aStart, bStart) <
        Math.min(aStart + a.durationMinutes, bStart + b.durationMinutes);
      if (!overlaps) continue;

      if (sameTitle(a.title, b.title) && a.time === b.time) {
        notices.push(`Duplicate avoided: ${a.title} at ${a.time}`);
      } else if (a.time === b.time) {
        notices.push(
          `Same start: ${a.title} + ${b.title} at ${a.time}. Both can notify.`
        );
      } else {
        notices.push(`Overlap: ${a.title} (${a.time}) and ${b.title} (${b.time}).`);
      }

      if (notices.length >= 4) return notices;
    }
  }

  return notices;
}

function ToolCard({
  block,
  applied,
  onApply,
}: {
  block: ToolUseBlock;
  applied: boolean;
  onApply: () => void;
}) {
  const Icon = TOOL_ICONS[block.name] ?? Sparkles;
  const label = TOOL_LABELS[block.name] ?? block.name;
  const isPlan = block.name === "plan_day";
  const planBlocks = isPlan && Array.isArray(block.input.blocks) ? (block.input.blocks as Array<Record<string, unknown>>) : [];
  const blueprint =
    block.name === "build_life_system" ? normalizeBlueprint(block.input) : null;
  const title = isPlan
    ? `${planBlocks.length} blocks for ${String(block.input.date ?? "")}`
    : String(block.input.title ?? "");
  const detailParts: string[] = [];
  if (!isPlan) {
    if (block.input.target) detailParts.push(`target ${block.input.target} ${block.input.unit ?? ""}`.trim());
    if (block.input.pattern) detailParts.push(String(block.input.pattern));
    if (block.input.date) detailParts.push(String(block.input.date));
    if (block.input.time) detailParts.push(String(block.input.time));
    if (block.input.duration_minutes) detailParts.push(`${block.input.duration_minutes}m`);
    if (block.input.due_date) detailParts.push(`due ${block.input.due_date}`);
    if (block.input.goal_title) detailParts.push(`→ ${block.input.goal_title}`);
    if (block.input.priority) detailParts.push(`${block.input.priority} priority`);
    if (block.input.emoji && block.name === "create_habit") detailParts.unshift(String(block.input.emoji));
  }

  if (blueprint) {
    const timeline = [...blueprint.templates].sort((a, b) =>
      a.time.localeCompare(b.time)
    );
    const notices = blueprintNotices(timeline);
    const profile = blueprint.profile ?? {};

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-3 rounded-xl border transition ${
          applied
            ? "bg-[var(--success)]/10 border-[var(--success)]/30"
            : "bg-[var(--surface-2)] border-[var(--border)]"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              applied
                ? "bg-[var(--success)]/20 text-[var(--success)]"
                : "bg-[var(--surface)] text-[var(--accent)]"
            }`}
          >
            {applied ? <Check size={14} /> : <Icon size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-0.5">
              {label}
            </p>
            <p className="text-sm font-semibold truncate">
              {blueprint.name ?? "Life system"}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
              {blueprint.summary}
            </p>
          </div>
          {!applied && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onApply}
              className="px-2.5 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90"
            >
              Apply
            </motion.button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
            <p className="text-[10px] text-[var(--muted)]">Wake</p>
            <p className="text-xs font-semibold">{profile.wakeTime ?? "--"}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
            <p className="text-[10px] text-[var(--muted)]">Templates</p>
            <p className="text-xs font-semibold">{blueprint.templates.length}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
            <p className="text-[10px] text-[var(--muted)]">Created now</p>
            <p className="text-xs font-semibold">
              {blueprint.materializeDays ?? 7}d
            </p>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
            Daily timeline
          </p>
          <ul className="flex flex-col gap-0.5">
            {timeline.slice(0, 10).map((t, i) => (
              <li key={`${t.time}-${t.title}-${i}`} className="text-[11px] text-[var(--muted)] truncate">
                <span className="font-mono text-[var(--foreground)]">{t.time}</span>{" "}
                - {t.title}{" "}
                <span className="opacity-60">
                  ({t.durationMinutes}m{t.phaseLabel ? `, ${t.phaseLabel}` : ""})
                </span>
              </li>
            ))}
            {timeline.length > 10 && (
              <li className="text-[11px] text-[var(--muted)] opacity-70">
                + {timeline.length - 10} more
              </li>
            )}
          </ul>
        </div>

        {blueprint.assumptions && blueprint.assumptions.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
              Assumptions
            </p>
            <ul className="flex flex-col gap-1">
              {blueprint.assumptions.slice(0, 4).map((item, i) => (
                <li key={i} className="text-[11px] text-[var(--muted)] leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2">
          <p className="text-[11px] font-medium">Automation path</p>
          <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
            Applying creates editable routines, schedules the next week, arms
            push reminders, updates the live calendar feed, and pushes to Google
            Calendar when connected.
          </p>
        </div>

        {notices.length > 0 && (
          <div className="mt-2 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 p-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--danger)]">
              <AlertTriangle size={12} />
              Overlap check
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
              {notices.map((notice, i) => (
                <li key={i} className="text-[11px] text-[var(--muted)]">
                  {notice}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 p-3 rounded-xl border transition ${
        applied
          ? "bg-[var(--success)]/10 border-[var(--success)]/30"
          : "bg-[var(--surface-2)] border-[var(--border)]"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          applied ? "bg-[var(--success)]/20 text-[var(--success)]" : "bg-[var(--surface)] text-[var(--accent)]"
        }`}
      >
        {applied ? <Check size={14} /> : <Icon size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-0.5">
          {label}
        </p>
        <p className="text-sm font-medium truncate">{title}</p>
        {detailParts.length > 0 && (
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {detailParts.join(" · ")}
          </p>
        )}
        {isPlan && planBlocks.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {planBlocks.slice(0, 8).map((b, i) => (
              <li key={i} className="text-[11px] text-[var(--muted)] truncate">
                <span className="font-mono text-[var(--foreground)]">{String(b.time ?? "")}</span>{" "}
                · {String(b.title ?? "")}{" "}
                <span className="opacity-60">({Number(b.duration_minutes ?? 30)}m)</span>
              </li>
            ))}
            {planBlocks.length > 8 && (
              <li className="text-[11px] text-[var(--muted)] opacity-70">
                + {planBlocks.length - 8} more
              </li>
            )}
          </ul>
        )}
      </div>
      {!applied && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onApply}
          className="px-2.5 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90"
        >
          Apply
        </motion.button>
      )}
    </motion.div>
  );
}

export function AgentPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const consumeAIPrompt = useUIStore((s) => s.consumeAIPrompt);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const prompt = consumeAIPrompt();
    if (prompt) {
      send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function callAgent(history: Message[], recovered = false) {
    setLoading(true);
    setError("");
    try {
      const apiMessages = history.map((m) => ({
        role: m.role,
        content: m.content.map((b) => {
          if (b.type === "text") return { type: "text" as const, text: b.text };
          if (b.type === "tool_use")
            return {
              type: "tool_use" as const,
              id: b.id,
              name: b.name,
              input: b.input,
            };
          return {
            type: "tool_result" as const,
            tool_use_id: b.tool_use_id,
            content: b.content,
            is_error: b.is_error,
          };
        }),
      }));
      let res: Response | null = null;
      let data: { content?: ContentBlock[]; error?: string; retryable?: boolean } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            state: buildStateSnapshot(),
          }),
        });
        data = await res.json();
        if (res.ok || ![408, 429, 500, 502, 503, 529].includes(res.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 700 + attempt * 1000));
      }
      if (!res || !data) throw new Error("No response from AI");
      if (!res.ok) {
        if (res.status === 400 && !recovered) {
          const lastUser = [...history]
            .reverse()
            .find((m) => m.role === "user")
            ?.content.filter((b): b is TextBlock => b.type === "text")
            .map((b) => b.text)
            .join(" ")
            .trim();
          if (lastUser) {
            const fresh: Message[] = [
              { role: "user", content: [{ type: "text", text: lastUser }] },
            ];
            setMessages(fresh);
            await callAgent(fresh, true);
            return;
          }
        }
        const friendly =
          data.error ??
          "The AI service is having a rough moment. Your data is safe; try again in a few seconds.";
        const assistantMsg: Message = {
          role: "assistant",
          content: [{ type: "text", text: friendly }],
        };
        setMessages([...history, assistantMsg]);
        setLoading(false);
        return;
      }
      const assistantMsg: Message = {
        role: "assistant",
        content: data.content ?? [
          {
            type: "text",
            text: "I did not get a usable response. Try one shorter sentence and I will turn it into a plan.",
          },
        ],
      };
      setMessages([...history, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const skippedResults: ToolResultBlock[] = [];
    const updatedMessages = [...messages];
    const last = updatedMessages[updatedMessages.length - 1];
    if (last && last.role === "assistant") {
      const applied = last.appliedToolIds ?? new Set();
      const skips: ToolUseBlock[] = [];
      for (const b of last.content) {
        if (b.type === "tool_use" && !applied.has(b.id)) skips.push(b);
      }
      if (skips.length > 0) {
        const newApplied = new Set(applied);
        for (const s of skips) {
          newApplied.add(s.id);
          skippedResults.push({
            type: "tool_result",
            tool_use_id: s.id,
            content: "User chose not to apply this proposal.",
          });
        }
        updatedMessages[updatedMessages.length - 1] = {
          ...last,
          appliedToolIds: newApplied,
        };
      }
    }
    const next: Message = {
      role: "user",
      content: [...skippedResults, { type: "text", text: trimmed }],
    };
    const history = [...updatedMessages, next];
    setMessages(history);
    setInput("");
    callAgent(history);
  }

  function applyToolUse(messageIdx: number, toolUse: ToolUseBlock) {
    const result = applyToolCall(toolUse.name, toolUse.input);
    setMessages((prev) => {
      const copy = [...prev];
      const m = { ...copy[messageIdx] };
      const applied = new Set(m.appliedToolIds ?? []);
      applied.add(toolUse.id);
      m.appliedToolIds = applied;
      copy[messageIdx] = m;
      const allApplied = m.content
        .filter((b): b is ToolUseBlock => b.type === "tool_use")
        .every((b) => applied.has(b.id));
      if (allApplied) {
        const toolResults: ToolResultBlock[] = m.content
          .filter((b): b is ToolUseBlock => b.type === "tool_use")
          .map((b) => ({
            type: "tool_result",
            tool_use_id: b.id,
            content:
              b.id === toolUse.id
                ? result
                : `Applied "${String(b.input.title ?? b.name)}".`,
          }));
        const followup: Message = { role: "user", content: toolResults };
        const newHistory = [...copy, followup];
        callAgent(newHistory);
        return newHistory;
      }
      return copy;
    });
  }

  function applyAll(messageIdx: number) {
    const m = messages[messageIdx];
    const toolUses = m.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    const applied = new Set(m.appliedToolIds ?? []);
    const toolResults: ToolResultBlock[] = [];
    for (const tu of toolUses) {
      if (applied.has(tu.id)) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Already applied.`,
        });
        continue;
      }
      const result = applyToolCall(tu.name, tu.input);
      applied.add(tu.id);
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    const copy = [...messages];
    copy[messageIdx] = { ...m, appliedToolIds: applied };
    const followup: Message = { role: "user", content: toolResults };
    const newHistory = [...copy, followup];
    setMessages(newHistory);
    callAgent(newHistory);
  }

  function reset() {
    setMessages([]);
    setError("");
  }

  function showExampleBlueprint() {
    if (loading) return;
    const blueprint = exampleLifeSystemBlueprint();
    const now = Date.now();
    const assistantMsg: Message = {
      role: "assistant",
      content: [
        {
          type: "text",
          text:
            "Here is a ready-to-use setup. Review it first, then apply it if it matches the system you want.",
        },
        {
          type: "tool_use",
          id: `example-life-system-${now}`,
          name: "build_life_system",
          input: blueprint as unknown as Record<string, unknown>,
        },
      ],
    };
    setMessages((prev) => [...prev, assistantMsg]);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="fixed top-0 right-0 h-full w-full sm:w-[420px] glass border-l border-[var(--border)] z-40 flex flex-col"
        >
          <header className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/30">
                <Sparkles size={14} className="text-white" />
              </div>
              <h2 className="font-semibold">AI Planner</h2>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2"
                >
                  Reset
                </button>
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto scroll-hidden p-4 flex flex-col gap-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center text-center pt-6 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center shadow-xl shadow-[var(--accent)]/30">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">What do you want to do?</h3>
                  <p className="text-xs text-[var(--muted)] max-w-xs">
                    Tell me a goal, an intention, or how you want your week to
                    look. I&apos;ll propose a concrete plan and schedule it for
                    you.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {QUICK_ACTIONS.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={() => send(qa.prompt)}
                      className="text-xs px-3 py-1.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] border border-[var(--border)] transition"
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={showExampleBlueprint}
                  className="text-xs px-3 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition"
                >
                  Load ready-to-use example
                </button>
              </div>
            )}

            {messages.map((m, idx) => {
              if (m.role === "user") {
                const text = m.content
                  .filter((b): b is TextBlock => b.type === "text")
                  .map((b) => b.text)
                  .join(" ");
                const toolResults = m.content.filter(
                  (b): b is ToolResultBlock => b.type === "tool_result"
                );
                if (text) {
                  return (
                    <div key={idx} className="flex justify-end">
                      <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white text-sm px-3 py-2 rounded-2xl rounded-br-md max-w-[85%]">
                        {text}
                      </div>
                    </div>
                  );
                }
                if (toolResults.length > 0) {
                  return null;
                }
                return null;
              }

              const textBlocks = m.content.filter(
                (b): b is TextBlock => b.type === "text"
              );
              const toolUses = m.content.filter(
                (b): b is ToolUseBlock => b.type === "tool_use"
              );
              const applied = m.appliedToolIds ?? new Set();
              const pendingCount = toolUses.filter((b) => !applied.has(b.id)).length;
              return (
                <div key={idx} className="flex flex-col gap-2">
                  {textBlocks.map((b, i) => (
                    <p key={i} className="text-sm leading-relaxed">
                      {b.text}
                    </p>
                  ))}
                  {toolUses.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {toolUses.map((tu) => (
                        <ToolCard
                          key={tu.id}
                          block={tu}
                          applied={applied.has(tu.id)}
                          onApply={() => applyToolUse(idx, tu)}
                        />
                      ))}
                      {pendingCount > 1 && (
                        <button
                          onClick={() => applyAll(idx)}
                          className="self-end text-xs px-3 py-1.5 rounded-full bg-[var(--accent)] text-white font-medium hover:opacity-90"
                        >
                          Apply all {pendingCount}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 size={14} className="animate-spin" />
                Thinking…
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30">
                <AlertTriangle size={14} className="text-[var(--danger)] mt-0.5" />
                <p className="text-xs text-[var(--danger)] flex-1">{error}</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] focus-within:border-[var(--accent)] transition">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder="Tell me what you want…"
                className="flex-1 bg-transparent text-sm px-2 placeholder:text-[var(--muted)]"
                disabled={loading}
              />
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center disabled:opacity-40 shadow-lg shadow-[var(--accent)]/20"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </motion.button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
