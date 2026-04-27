import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bluefan.theme.settings";
const THEME_PRESETS = {
  lumineux: {
    label: "Clair",
    pageBg: "#f5f9ff",
    headerBg: "rgba(255,255,255,0.9)",
    cardBg: "rgba(255,255,255,0.95)",
    cardBorder: "#dbe7ff",
    cardShadow: "0 18px 40px rgba(12,111,249,0.08)",
    textColor: "#1f2a44",
    mutedText: "#4e5d7a",
    axisColor: "#4e5d7a",
    heroBg: "linear-gradient(135deg,rgba(12,111,249,0.12),rgba(19,194,194,0.12))",
  },
  nocturne: {
    label: "Nocturne",
    pageBg: "#101422",
    headerBg: "rgba(22,27,40,0.9)",
    cardBg: "rgba(27,35,56,0.88)",
    cardBorder: "#2c3b5c",
    cardShadow: "0 22px 48px rgba(12,111,249,0.18)",
    textColor: "#e6f1ff",
    mutedText: "#9db2d7",
    axisColor: "#9db2d7",
    heroBg: "linear-gradient(135deg,rgba(146,84,222,0.26),rgba(12,111,249,0.24))",
  },
  holographique: {
    label: "Holo",
    pageBg: "linear-gradient(140deg,#0b1227 0%,#1f3053 48%,#3f6cdf 100%)",
    headerBg: "rgba(16,26,48,0.65)",
    cardBg: "rgba(18,31,58,0.72)",
    cardBorder: "#3a588f",
    cardShadow: "0 28px 60px rgba(28,102,255,0.35)",
    textColor: "#f4fbff",
    mutedText: "#bcd6ff",
    axisColor: "#bcd6ff",
    heroBg: "linear-gradient(140deg,rgba(33,126,255,0.35),rgba(114,46,209,0.35))",
  },
};
const ACCENT_OPTIONS = [
  { label: "Bleu néon", value: "#0c6ff9" },
  { label: "Turquoise", value: "#13c2c2" },
  { label: "Magenta", value: "#eb2f96" },
  { label: "Ambre", value: "#fa8c16" },
  { label: "Ultra Violet", value: "#722ed1" },
];
const DENSITY_OPTIONS = [
  { label: "Standard", value: "comfortable" },
  { label: "Compact", value: "compact" },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("lumineux");
  const [accent, setAccent] = useState("#0c6ff9");
  const [density, setDensity] = useState("comfortable");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (stored.mode) setMode(stored.mode);
      if (stored.accent) setAccent(stored.accent);
      if (stored.density) setDensity(stored.density);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent, density }));
    } catch {
      /* ignore */
    }
  }, [mode, accent, density]);

  const styles = useMemo(() => ({ ...(THEME_PRESETS[mode] ?? THEME_PRESETS.lumineux), accent }), [mode, accent]);
  const antdTheme = useMemo(
    () => ({
      token: {
        colorPrimary: accent,
        colorBgBase: styles.pageBg,
        colorTextBase: styles.textColor,
        borderRadius: density === "compact" ? 6 : 10,
      },
      components: {
        Card: { colorBgContainer: styles.cardBg, colorBorderSecondary: styles.cardBorder },
        Table: {
          colorBgContainer: styles.cardBg,
          headerBg: styles.cardBg,
          colorText: styles.textColor,
          padding: density === "compact" ? 8 : 12,
        },
        Tabs: { itemColor: styles.mutedText },
        Statistic: { titleColor: styles.mutedText, contentColor: styles.textColor },
        Layout: { colorBgBody: styles.pageBg },
      },
    }),
    [accent, styles, density]
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      accent,
      setAccent,
      density,
      setDensity,
      presets: THEME_PRESETS,
      accentOptions: ACCENT_OPTIONS,
      densityOptions: DENSITY_OPTIONS,
      styles,
      antdTheme,
      resetTheme: () => {
        setMode("lumineux");
        setAccent("#0c6ff9");
        setDensity("comfortable");
      },
    }),
    [mode, accent, density, styles, antdTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useThemeConfig = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeConfig must be used inside ThemeProvider");
  return ctx;
};
