"use client";

import { X, Sparkles } from "lucide-react";

export function AIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <aside className="fixed top-0 right-0 h-full w-full sm:w-96 glass border-l border-[var(--border)] z-40 flex flex-col slide-up">
      <header className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--accent)]" />
          <h2 className="font-semibold">AI Assistant</h2>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </header>
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-sm text-[var(--muted)]">
        <Sparkles size={24} className="text-[var(--accent)] mb-3" />
        <p className="font-medium text-[var(--foreground)] mb-1">
          AI assistant coming up next
        </p>
        <p className="max-w-xs">
          In the next step we&apos;ll wire this up to Claude so it can summarize
          your week, rewrite goals, and suggest tasks based on your progress.
        </p>
      </div>
    </aside>
  );
}
