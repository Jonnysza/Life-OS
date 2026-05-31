"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { WeekStrip } from "@/components/WeekStrip";
import { HabitsPanel } from "@/components/HabitsPanel";
import { GoalsPanel } from "@/components/GoalsPanel";
import { TodosPanel } from "@/components/TodosPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { CalendarPanel } from "@/components/CalendarPanel";
import { AgentPanel } from "@/components/AgentPanel";
import { Whiteboard } from "@/components/Whiteboard";
import { ScheduleSyncProvider } from "@/components/ScheduleSyncProvider";
import { SyncProvider } from "@/components/SyncProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useStore } from "@/lib/store";
import { useUIStore } from "@/lib/uiStore";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const selectedDate = useStore((s) => s.selectedDate);
  const aiOpen = useUIStore((s) => s.aiOpen);
  const closeAI = useUIStore((s) => s.closeAI);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) useStore.getState().materializeForDate(selectedDate);
  }, [mounted, selectedDate]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted)] text-sm">
        Loading Life OS…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ThemeProvider />
      <Header />

      <main className="w-full max-w-7xl mx-auto flex-1 p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Hero />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <WeekStrip />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-3 sm:gap-4 grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]"
        >
          <div className="min-h-[520px]">
            <TodosPanel />
          </div>
          <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
            <GoalsPanel />
            <NotesPanel />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
        >
          <HabitsPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="min-h-[560px]"
        >
          <CalendarPanel />
        </motion.div>
      </main>

      <Whiteboard />
      <AgentPanel open={aiOpen} onClose={closeAI} />
      <ScheduleSyncProvider />
      <SyncProvider />
    </div>
  );
}
