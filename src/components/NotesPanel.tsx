"use client";

import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useStore, useNoteFor } from "@/lib/store";

export function NotesPanel() {
  const selectedDate = useStore((s) => s.selectedDate);
  const note = useNoteFor(selectedDate);
  const upsertNote = useStore((s) => s.upsertNote);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(note?.content ?? "");
  }, [note?.id, selectedDate]);

  useEffect(() => {
    if (draft === (note?.content ?? "")) return;
    const t = setTimeout(() => {
      upsertNote(selectedDate, draft);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, selectedDate, note?.content, upsertNote]);

  return (
    <section className="glass rounded-2xl p-5 flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
          <NotebookPen size={14} />
          Notes
        </h2>
        {note && draft !== note.content && (
          <span className="text-xs text-[var(--muted)]">saving…</span>
        )}
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Thoughts, reflections, ideas for this day…"
        className="flex-1 min-h-0 w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-3 text-sm resize-none placeholder:text-[var(--muted)] leading-relaxed"
      />
    </section>
  );
}
