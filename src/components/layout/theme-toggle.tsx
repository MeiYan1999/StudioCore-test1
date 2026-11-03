"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "studiocore-theme";
const THEME_EVENT = "studiocore-theme-change";

function readTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
}

function writeTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (readTheme() === "system") {
      applyTheme("system");
      listener();
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(readTheme());
      listener();
    }
  };
  const onThemeChange = () => listener();

  media.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_EVENT, onThemeChange);

  return () => {
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_EVENT, onThemeChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => "system");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme: Theme =
    theme === "system" ? "light" : theme === "light" ? "dark" : "system";

  const label =
    theme === "system"
      ? "Giao diện theo hệ thống"
      : theme === "light"
        ? "Giao diện sáng"
        : "Giao diện tối";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${label}. Bấm để chuyển sang ${
        nextTheme === "system" ? "theo hệ thống" : nextTheme === "light" ? "sáng" : "tối"
      }.`}
      title={label}
      onClick={() => writeTheme(nextTheme)}
    >
      {theme === "system" ? (
        <Monitor className="h-4 w-4" aria-hidden="true" />
      ) : theme === "light" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
