
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("devsync-theme") === "dark";
    } catch {
      return document.documentElement.classList.contains("dark");
    }
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", isDark);

    try {
      localStorage.setItem("devsync-theme", isDark ? "dark" : "light");
    } catch (error) {
      console.error("Could not save DevSync theme:", error);
    }
  }, [isDark]);

  function toggleTheme() {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    setIsDark((previous) => !previous);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-switching");
      });
    });
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-muted hover:bg-hover hover:text-text"
    >
      {isDark ? (
        <Sun size={18} strokeWidth={1.8} />
      ) : (
        <Moon size={18} strokeWidth={1.8} />
      )}
    </button>
  );
}
