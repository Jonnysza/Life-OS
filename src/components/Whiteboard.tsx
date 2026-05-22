"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Plus,
  Sparkles,
  Trash2,
  Eraser,
  Layers,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUIStore } from "@/lib/uiStore";
import type { StickyNote } from "@/lib/types";

const STICKY_COLORS = [
  "#fde68a",
  "#fca5a5",
  "#a7f3d0",
  "#bfdbfe",
  "#c7d2fe",
  "#fbcfe8",
  "#fdba74",
];

function Sticky({
  note,
  onChange,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  note: StickyNote;
  onChange: (patch: Partial<StickyNote>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={(_, info) => {
        onDragEnd(note.x + info.offset.x, note.y + info.offset.y);
      }}
      whileDrag={{ scale: 1.04, zIndex: 30, rotate: -1 }}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1, x: note.x, y: note.y }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="absolute w-56 min-h-[140px] rounded-xl shadow-2xl p-3 cursor-grab active:cursor-grabbing group flex flex-col"
      style={{
        background: note.color,
        color: "#1a1a25",
        boxShadow: `0 12px 32px -8px ${note.color}80, 0 4px 8px rgba(0,0,0,0.2)`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <input
          value={note.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title…"
          className="bg-transparent text-xs font-bold placeholder:text-black/30 flex-1 min-w-0"
        />
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-black/40 hover:text-black/70 transition flex-shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <textarea
        value={note.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Write a thought, vision, ambition…"
        className="bg-transparent text-xs placeholder:text-black/40 flex-1 resize-none leading-relaxed"
      />
      <div className="flex items-center gap-0.5 mt-1.5">
        {STICKY_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ color: c })}
            className="w-3.5 h-3.5 rounded-full"
            style={{
              background: c,
              outline: note.color === c ? "2px solid rgba(0,0,0,0.4)" : "none",
              outlineOffset: 1,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function Whiteboard() {
  const open = useUIStore((s) => s.whiteboardOpen);
  const close = useUIStore((s) => s.closeWhiteboard);
  const openAI = useUIStore((s) => s.openAI);
  const stickies = useStore((s) => s.stickies);
  const addSticky = useStore((s) => s.addSticky);
  const updateSticky = useStore((s) => s.updateSticky);
  const deleteSticky = useStore((s) => s.deleteSticky);
  const clearStickies = useStore((s) => s.clearStickies);

  const [confirmClear, setConfirmClear] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  function addNote() {
    const rect = canvasRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 800;
    const h = rect?.height ?? 600;
    const x = Math.floor(Math.random() * (w - 250)) + 20;
    const y = Math.floor(Math.random() * (h - 200)) + 20;
    addSticky({
      content: "",
      color:
        STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      x,
      y,
    });
  }

  function interpretWithAI() {
    if (stickies.length === 0) {
      addSticky({
        content: "Add a sticky note first describing what you want.",
        color: STICKY_COLORS[1],
        x: 80,
        y: 80,
      });
      return;
    }
    const board = stickies
      .map((n, i) => {
        const t = (n.title || "").trim();
        const c = n.content.trim();
        if (!t && !c) return null;
        return `${i + 1}. ${t ? `[${t}] ` : ""}${c}`;
      })
      .filter(Boolean)
      .join("\n");
    const prompt = `Here's my vision board — a brain-dump of thoughts, ideas, and ambitions. Read it carefully, then tell me in plain language what you understand my vision to be. Restate it in 2-3 sentences. Then propose a concrete plan: goals, habits, recurring tasks, and time blocks that would actually move me toward this vision. Ask me to confirm before applying anything I'm uncertain about.

VISION BOARD:
${board}`;
    close();
    openAI(prompt);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[var(--background)]/95 backdrop-blur-md flex flex-col"
        >
          <header className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Layers size={16} className="text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Vision Board</h2>
                <p className="text-xs text-[var(--muted)]">
                  Brain-dump. Then let the AI interpret and build the plan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={addNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] text-sm transition"
              >
                <Plus size={14} /> Note
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={interpretWithAI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/30"
              >
                <Sparkles size={14} /> Interpret with AI
              </motion.button>
              <button
                onClick={() => {
                  if (confirmClear) {
                    clearStickies();
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 3000);
                  }
                }}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition ${
                  confirmClear
                    ? "bg-[var(--danger)] text-white"
                    : "hover:bg-[var(--surface-2)] text-[var(--muted)]"
                }`}
                title={confirmClear ? "Tap again to clear all" : "Clear all"}
              >
                <Eraser size={14} />
              </button>
              <button
                onClick={close}
                className="w-8 h-8 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          <div
            ref={canvasRef}
            className="flex-1 relative overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0",
            }}
          >
            {stickies.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center shadow-2xl shadow-amber-500/30 mb-4">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  What does your best year look like?
                </h3>
                <p className="text-sm text-[var(--muted)] max-w-md mb-4">
                  Drop sticky notes here. Loose thoughts, half-formed ambitions,
                  things you want — doesn&apos;t have to make sense yet.
                  The AI reads the whole board and tells you what it understood
                  before building a plan.
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={addNote}
                  className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] text-sm transition"
                >
                  <Plus size={14} /> Add first note
                </motion.button>
              </div>
            )}
            <AnimatePresence>
              {stickies.map((n) => (
                <Sticky
                  key={n.id}
                  note={n}
                  onChange={(patch) => updateSticky(n.id, patch)}
                  onDelete={() => deleteSticky(n.id)}
                  onDragStart={() => {}}
                  onDragEnd={(x, y) =>
                    updateSticky(n.id, { x, y })
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
