"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Settings, BarChart3, Layers } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { SettingsModal } from "./SettingsModal";
import { useUIStore } from "@/lib/uiStore";

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openAI = useUIStore((s) => s.openAI);
  const openWhiteboard = useUIStore((s) => s.openWhiteboard);

  return (
    <>
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] glass sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90">
          <motion.div
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center font-bold text-white shadow-lg shadow-[var(--accent)]/20"
          >
            L
          </motion.div>
          <h1 className="text-lg font-semibold tracking-tight">Life OS</h1>
        </Link>

        <div className="flex items-center gap-2">
          <CommandPalette />
          <button
            onClick={openWhiteboard}
            className="w-9 h-9 rounded-full glass border border-[var(--border)] hover:border-[var(--muted)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition"
            title="Vision board"
          >
            <Layers size={14} />
          </button>
          <Link
            href="/stats"
            className="w-9 h-9 rounded-full glass border border-[var(--border)] hover:border-[var(--muted)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition"
            title="Stats"
          >
            <BarChart3 size={14} />
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full glass border border-[var(--border)] hover:border-[var(--muted)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition"
            title="Settings"
          >
            <Settings size={14} />
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openAI()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/30"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">AI</span>
          </motion.button>
        </div>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
