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
import { Pomodoro } from "@/components/Pomodoro";
import { Whiteboard } from "@/components/Whiteboard";
import { ScheduleSyncProvider } from "@/components/ScheduleSyncProvider";
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
      <Header />

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
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
        >
          <HabitsPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[1fr_1.2fr_1fr] flex-1 min-h-[640px]"
        >
          <GoalsPanel />
          <div className="grid gap-4 sm:gap-6 grid-rows-[1fr_1fr] min-h-0">
            <TodosPanel />
            <CalendarPanel />
          </div>
          <NotesPanel />
        </motion.div>
      </main>

      <Pomodoro />
      <Whiteboard />
      <AgentPanel open={aiOpen} onClose={closeAI} />
      <ScheduleSyncProvider />
    </div>
  );
}
