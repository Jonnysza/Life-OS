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
  { label: "Plan my day", prompt: "Look at my goals, habits, and pending tasks. Plan a focused, realistic schedule for today and propose any todos or events I'm missing." },
  { label: "New goal", prompt: "I want to set up a new goal. Ask me what it is, then propose a full plan." },
  { label: "Weekly review", prompt: "Summarize my progress this week toward my goals. Suggest adjustments — what to drop, what to add — and propose them as concrete changes." },
  { label: "What's next?", prompt: "Look at my goals and what I've done recently. Propose the highest-leverage next 3 things I should add to my plan." },
];

const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  create_goal: Target,
  create_habit: Repeat,
  create_recurring_rule: Repeat,
  create_todo: ListChecks,
  create_event: CalendarPlus,
};

const TOOL_LABELS: Record<string, string> = {
  create_goal: "New goal",
  create_habit: "New habit",
  create_recurring_rule: "Recurring task",
  create_todo: "New todo",
  create_event: "New event",
};

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
  const title = String(block.input.title ?? "");
  const detailParts: string[] = [];
  if (block.input.target) detailParts.push(`target ${block.input.target} ${block.input.unit ?? ""}`.trim());
  if (block.input.pattern) detailParts.push(String(block.input.pattern));
  if (block.input.date) detailParts.push(String(block.input.date));
  if (block.input.time) detailParts.push(String(block.input.time));
  if (block.input.due_date) detailParts.push(`due ${block.input.due_date}`);
  if (block.input.goal_title) detailParts.push(`→ ${block.input.goal_title}`);
  if (block.input.priority) detailParts.push(`${block.input.priority} priority`);
  if (block.input.emoji && block.name === "create_habit") detailParts.unshift(String(block.input.emoji));

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

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function callAgent(history: Message[]) {
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
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          state: buildStateSnapshot(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Agent error");
        setLoading(false);
        return;
      }
      const assistantMsg: Message = {
        role: "assistant",
        content: data.content as ContentBlock[],
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
    const next: Message = {
      role: "user",
      content: [{ type: "text", text: trimmed }],
    };
    const history = [...messages, next];
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
