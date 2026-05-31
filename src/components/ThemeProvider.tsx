"use client";

import { useEffect } from "react";
import { THEME_PRESETS, type DashboardTheme } from "@/lib/types";
import { useStore } from "@/lib/store";

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "8b5cf6";
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((v) => clamp(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(a: string, b: string, amount: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r * (1 - amount) + y.r * amount,
    g: x.g * (1 - amount) + y.g * amount,
    b: x.b * (1 - amount) + y.b * amount,
  });
}

function customTheme(accent: string, accent2: string): DashboardTheme {
  return {
    label: "Custom",
    background: mix("#090a0f", accent, 0.12),
    surface: mix("#11131a", accent, 0.1),
    surface2: mix("#1a1d27", accent2, 0.12),
    border: mix("#2b2f3a", accent2, 0.18),
    foreground: "#f3f5f8",
    muted: mix("#8b93a7", accent2, 0.14),
    accent,
    accent2,
    success: mix("#10b981", accent2, 0.08),
    danger: mix("#f43f5e", accent, 0.06),
  };
}

export function ThemeProvider() {
  const preset = useStore((s) => s.settings.themePreset ?? "violet");
  const customAccent = useStore((s) => s.settings.customAccent);
  const customAccent2 = useStore((s) => s.settings.customAccent2);

  useEffect(() => {
    const theme =
      preset === "custom"
        ? customTheme(
            customAccent || THEME_PRESETS.violet.accent,
            customAccent2 || THEME_PRESETS.violet.accent2
          )
        : THEME_PRESETS[preset] ?? THEME_PRESETS.violet;
    const root = document.documentElement;
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--surface", theme.surface);
    root.style.setProperty("--surface-2", theme.surface2);
    root.style.setProperty("--border", theme.border);
    root.style.setProperty("--foreground", theme.foreground);
    root.style.setProperty("--muted", theme.muted);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-2", theme.accent2);
    root.style.setProperty("--success", theme.success);
    root.style.setProperty("--danger", theme.danger);
  }, [customAccent, customAccent2, preset]);

  return null;
}
