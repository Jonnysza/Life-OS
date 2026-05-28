"use client";

import { useEffect } from "react";
import { THEME_PRESETS } from "@/lib/types";
import { useStore } from "@/lib/store";

export function ThemeProvider() {
  const preset = useStore((s) => s.settings.themePreset ?? "violet");
  const customAccent = useStore((s) => s.settings.customAccent);
  const customAccent2 = useStore((s) => s.settings.customAccent2);

  useEffect(() => {
    const theme =
      preset === "custom"
        ? {
            accent: customAccent || THEME_PRESETS.violet.accent,
            accent2: customAccent2 || THEME_PRESETS.violet.accent2,
          }
        : THEME_PRESETS[preset] ?? THEME_PRESETS.violet;
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-2", theme.accent2);
  }, [customAccent, customAccent2, preset]);

  return null;
}
