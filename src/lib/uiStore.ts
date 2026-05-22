"use client";

import { create } from "zustand";

type UIState = {
  aiOpen: boolean;
  aiPrefilledPrompt: string | null;
  whiteboardOpen: boolean;
  openAI: (prompt?: string) => void;
  closeAI: () => void;
  consumeAIPrompt: () => string | null;
  openWhiteboard: () => void;
  closeWhiteboard: () => void;
};

export const useUIStore = create<UIState>((set, get) => ({
  aiOpen: false,
  aiPrefilledPrompt: null,
  whiteboardOpen: false,
  openAI: (prompt) =>
    set({ aiOpen: true, aiPrefilledPrompt: prompt ?? null }),
  closeAI: () => set({ aiOpen: false, aiPrefilledPrompt: null }),
  consumeAIPrompt: () => {
    const p = get().aiPrefilledPrompt;
    if (p) set({ aiPrefilledPrompt: null });
    return p;
  },
  openWhiteboard: () => set({ whiteboardOpen: true }),
  closeWhiteboard: () => set({ whiteboardOpen: false }),
}));
