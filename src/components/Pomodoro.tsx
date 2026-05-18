"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, X, Timer, Coffee } from "lucide-react";
import { useStore } from "@/lib/store";
import { soundBell, soundTick } from "@/lib/sound";
import { celebrateBig } from "@/lib/celebrate";

type Mode = "focus" | "short" | "long";
const DURATIONS: Record<Mode, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const LABELS: Record<Mode, string> = { focus: "Focus", short: "Short break", long: "Long break" };

export function Pomodoro() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [completedFocusToday, setCompletedFocusToday] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addFocusSession = useStore((s) => s.addFocusSession);
  const soundEnabled = useStore((s) => s.settings.soundEnabled);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode]);

  useEffect(() => {
    setRemaining(DURATIONS[mode]);
  }, [mode]);

  useEffect(() => {
    if (running) {
      document.title = `${formatTime(remaining)} · ${LABELS[mode]} — Life OS`;
    } else {
      document.title = "Life OS";
    }
    return () => {
      document.title = "Life OS";
    };
  }, [running, remaining, mode]);

  function handleComplete() {
    setRunning(false);
    if (soundEnabled) soundBell();
    if (mode === "focus") {
      addFocusSession(25);
      setCompletedFocusToday((c) => c + 1);
      celebrateBig();
      setMode((completedFocusToday + 1) % 4 === 0 ? "long" : "short");
    } else {
      setMode("focus");
    }
  }

  function toggle() {
    if (!running && soundEnabled) soundTick();
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setRemaining(DURATIONS[mode]);
  }

  const pct = 1 - remaining / DURATIONS[mode];
  const fabColor =
    mode === "focus" ? "var(--accent)" : mode === "short" ? "#10b981" : "#06b6d4";

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white"
            style={{
              background: running
                ? `conic-gradient(${fabColor} ${pct * 360}deg, color-mix(in oklab, ${fabColor} 30%, transparent) 0deg)`
                : `linear-gradient(135deg, ${fabColor}, ${fabColor})`,
            }}
          >
            <div className="absolute inset-1 rounded-full bg-[var(--surface)] flex items-center justify-center">
              {running ? (
                <span className="font-mono text-xs font-semibold">
                  {formatTime(remaining)}
                </span>
              ) : (
                <Timer size={20} style={{ color: fabColor }} />
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 25 }}
            className="fixed bottom-5 right-5 z-30 w-72 glass rounded-2xl border border-[var(--border)] shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {mode === "focus" ? (
                  <Timer size={14} />
                ) : (
                  <Coffee size={14} />
                )}
                {LABELS[mode]}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>

            <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[var(--surface-2)]">
              {(["focus", "short", "long"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setRunning(false);
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
                    mode === m
                      ? "bg-[var(--surface)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {m === "focus" ? "25" : m === "short" ? "5" : "15"}m
                </button>
              ))}
            </div>

            <div className="relative flex items-center justify-center mb-4">
              <svg width="180" height="180" className="-rotate-90">
                <circle
                  cx="90"
                  cy="90"
                  r="76"
                  stroke="var(--surface-2)"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="90"
                  cy="90"
                  r="76"
                  stroke={fabColor}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 76}
                  animate={{
                    strokeDashoffset: 2 * Math.PI * 76 * (remaining / DURATIONS[mode]),
                  }}
                  transition={{ duration: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-mono font-semibold tabular-nums">
                  {formatTime(remaining)}
                </span>
                <span className="text-xs text-[var(--muted)] mt-1">
                  {completedFocusToday} session{completedFocusToday === 1 ? "" : "s"} today
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggle}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: fabColor }}
              >
                {running ? <Pause size={14} /> : <Play size={14} />}
                {running ? "Pause" : "Start"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={reset}
                className="w-11 h-11 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] flex items-center justify-center"
              >
                <RotateCcw size={14} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}
