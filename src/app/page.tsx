"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { DayCockpit } from "@/components/DayCockpit";
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
        Loading Life OS...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ThemeProvider />
      <Header />

      <main className="w-full max-w-[1440px] mx-auto flex-1 p-2 sm:p-4">
        <DayCockpit />
      </main>

      <Whiteboard />
      <AgentPanel open={aiOpen} onClose={closeAI} />
      <ScheduleSyncProvider />
      <SyncProvider />
    </div>
  );
}
