"use client";

import { motion } from "motion/react";
import { useStore, useMoodFor } from "@/lib/store";
import { MOOD_EMOJI } from "@/lib/types";

export function MoodPicker() {
  const selectedDate = useStore((s) => s.selectedDate);
  const mood = useMoodFor(selectedDate);
  const setMood = useStore((s) => s.setMood);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-[var(--muted)] mr-1">Mood</span>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = mood?.score === n;
        return (
          <motion.button
            key={n}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setMood(selectedDate, n as 1 | 2 | 3 | 4 | 5)}
            className={`w-7 h-7 rounded-full text-base flex items-center justify-center transition ${
              active
                ? "bg-[var(--accent)]/20 ring-2 ring-[var(--accent)]/50"
                : "opacity-50 hover:opacity-100"
            }`}
          >
            {MOOD_EMOJI[n]}
          </motion.button>
        );
      })}
    </div>
  );
}
