"use client";
import { useEffect } from "react";
import { THEME_KEY, useThemeStore } from "@/store/themeStore";

/** The inline script in layout.tsx sets the `dark` class before first paint; this mirrors it into the store
 *  and follows the OS setting until the person picks a theme themselves. */
export default function ThemeSync() {
  useEffect(() => {
    useThemeStore.setState({ theme: document.documentElement.classList.contains("dark") ? "dark" : "light" });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
      if (!saved) {
        document.documentElement.classList.toggle("dark", e.matches);
        useThemeStore.setState({ theme: e.matches ? "dark" : "light" });
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
