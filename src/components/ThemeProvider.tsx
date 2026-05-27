"use client";

import { useEffect } from "react";
import { THEME_PRESETS } from "@/lib/types";
import { useStore } from "@/lib/store";

export function ThemeProvider() {
  const preset = useStore((s) => s.settings.themePreset ?? "violet");

  useEffect(() => {
    const theme = THEME_PRESETS[preset] ?? THEME_PRESETS.violet;
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-2", theme.accent2);
  }, [preset]);

  return null;
}
