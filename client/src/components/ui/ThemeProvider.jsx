import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./ThemeContext";
const THEME_KEY = "devsync-theme";

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return ["light", "dark", "system"].includes(saved) ? saved : "light";
  } catch {
    return "light";
  }
}

function isDarkTheme(theme, systemPrefersDark) {
  return theme === "dark" || (theme === "system" && systemPrefersDark);
}

function applyTheme(theme, systemPrefersDark) {
  document.documentElement.classList.toggle("dark", isDarkTheme(theme, systemPrefersDark));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  const setTheme = useCallback((nextTheme) => {
    if (!["light", "dark", "system"].includes(nextTheme)) return;
    setThemeState(nextTheme);
    applyTheme(nextTheme, window.matchMedia("(prefers-color-scheme: dark)").matches);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Theme switching remains available when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    applyTheme(theme, systemPrefersDark);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Keep the in-memory theme if browser storage is unavailable.
    }

    if (theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      setSystemPrefersDark(media.matches);
      applyTheme("system", media.matches);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme, systemPrefersDark]);

  const value = useMemo(() => ({ theme, setTheme, isDark: isDarkTheme(theme, systemPrefersDark) }), [theme, setTheme, systemPrefersDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

