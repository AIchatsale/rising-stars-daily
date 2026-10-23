"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pandawm-theme", next ? "dark" : "light");
    } catch {
      // private mode can reject storage
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:text-foreground sm:px-3"
      aria-label={dark ? "切换到浅色" : "切换到深色"}
    >
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span className="hidden sm:inline">{dark ? "浅色" : "深色"}</span>
    </button>
  );
}
