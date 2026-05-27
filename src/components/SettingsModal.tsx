"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Download,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  Repeat,
  Plus,
  Palette,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { THEME_PRESETS } from "@/lib/types";
import { patternLabel } from "@/lib/recurrence";
import { toDateKey } from "@/lib/utils";
import { NotificationsSection } from "./NotificationsSection";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const clearAll = useStore((s) => s.clearAll);
  const rules = useStore((s) => s.rules);
  const goals = useStore((s) => s.goals);
  const addRule = useStore((s) => s.addRule);
  const deleteRule = useStore((s) => s.deleteRule);
  const materializeForDate = useStore((s) => s.materializeForDate);
  const selectedDate = useStore((s) => s.selectedDate);

  const [confirmingClear, setConfirmingClear] = useState(false);
  const [importError, setImportError] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newPattern, setNewPattern] = useState<"daily" | "weekdays" | "weekly">(
    "daily"
  );
  const [newWeekday, setNewWeekday] = useState(1);
  const [newGoalId, setNewGoalId] = useState("");

  function onExport() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-os-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      if (!importData(text)) {
        setImportError("Invalid file");
        setTimeout(() => setImportError(""), 2500);
      }
    };
    input.click();
  }

  function addNewRule() {
    if (!newTitle.trim()) return;
    addRule({
      title: newTitle.trim(),
      pattern: newPattern,
      weekday: newPattern === "weekly" ? newWeekday : undefined,
      goalId: newGoalId || undefined,
      startDate: toDateKey(new Date()),
    });
    setNewTitle("");
    materializeForDate(selectedDate);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto glass rounded-2xl border border-[var(--border)] shadow-2xl"
          >
            <header className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 glass z-10">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </header>

            <div className="p-5 space-y-6">
              <NotificationsSection />

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
                  Preferences
                </h3>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] mb-2">
                  <div className="flex items-center gap-3">
                    {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    <span className="text-sm">Sound effects</span>
                  </div>
                  <button
                    onClick={() =>
                      updateSettings({ soundEnabled: !settings.soundEnabled })
                    }
                    className={`w-11 h-6 rounded-full transition relative ${
                      settings.soundEnabled
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--border)]"
                    }`}
                  >
                    <motion.span
                      layout
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                      style={{
                        left: settings.soundEnabled ? "calc(100% - 22px)" : "2px",
                      }}
                    />
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="flex items-center gap-3 mb-3">
                    <Palette size={16} />
                    <span className="text-sm">Site color</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(THEME_PRESETS).map(([key, theme]) => (
                      <button
                        key={key}
                        onClick={() =>
                          updateSettings({
                            themePreset: key as keyof typeof THEME_PRESETS,
                          })
                        }
                        className={`h-10 rounded-xl border transition ${
                          settings.themePreset === key
                            ? "border-white/80 scale-[1.03]"
                            : "border-[var(--border)] hover:border-[var(--muted)]"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                        }}
                        title={theme.label}
                      />
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Recurring tasks
                  </h3>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2 mb-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task that repeats — e.g. Review goals"
                    className="bg-transparent text-sm"
                    onKeyDown={(e) => e.key === "Enter" && addNewRule()}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newPattern}
                      onChange={(e) =>
                        setNewPattern(e.target.value as "daily" | "weekdays" | "weekly")
                      }
                      className="bg-[var(--surface)] text-xs px-2 py-1.5 rounded-md border border-[var(--border)]"
                    >
                      <option value="daily">Every day</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    {newPattern === "weekly" && (
                      <select
                        value={newWeekday}
                        onChange={(e) => setNewWeekday(Number(e.target.value))}
                        className="bg-[var(--surface)] text-xs px-2 py-1.5 rounded-md border border-[var(--border)]"
                      >
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (d, i) => (
                            <option key={i} value={i}>
                              {d}
                            </option>
                          )
                        )}
                      </select>
                    )}
                    <select
                      value={newGoalId}
                      onChange={(e) => setNewGoalId(e.target.value)}
                      className="flex-1 bg-[var(--surface)] text-xs px-2 py-1.5 rounded-md border border-[var(--border)]"
                    >
                      <option value="">No goal link</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addNewRule}
                      className="px-2 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs flex items-center gap-1"
                    >
                      <Plus size={10} /> Add
                    </button>
                  </div>
                </div>
                <ul className="flex flex-col gap-1">
                  {rules.length === 0 && (
                    <li className="text-xs text-[var(--muted)] text-center py-2">
                      No recurring tasks yet.
                    </li>
                  )}
                  {rules.map((r) => (
                    <li
                      key={r.id}
                      className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)]"
                    >
                      <Repeat size={12} className="text-[var(--muted)]" />
                      <span className="text-sm flex-1">{r.title}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {patternLabel(r)}
                      </span>
                      <button
                        onClick={() => deleteRule(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
                  Data
                </h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={onExport}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] transition text-sm"
                  >
                    <Download size={14} />
                    Export all data (JSON)
                  </button>
                  <button
                    onClick={onImport}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] transition text-sm"
                  >
                    <Upload size={14} />
                    Import data
                  </button>
                  {importError && (
                    <p className="text-xs text-[var(--danger)]">{importError}</p>
                  )}
                  <button
                    onClick={() => {
                      if (confirmingClear) {
                        clearAll();
                        setConfirmingClear(false);
                        onClose();
                      } else {
                        setConfirmingClear(true);
                        setTimeout(() => setConfirmingClear(false), 4000);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition text-sm ${
                      confirmingClear
                        ? "bg-[var(--danger)] text-white"
                        : "bg-[var(--surface-2)] hover:bg-[var(--border)]"
                    }`}
                  >
                    <Trash2 size={14} />
                    {confirmingClear
                      ? "Tap again to confirm — this wipes everything"
                      : "Clear all data"}
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
