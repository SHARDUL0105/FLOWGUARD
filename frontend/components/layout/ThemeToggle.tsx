"use client";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

/** Both icons are always rendered and swapped with CSS, so server and client markup match. */
export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="navctl flex h-8 w-8 items-center justify-center rounded-full border border-ink/20 bg-surface/40 text-ink/80 backdrop-blur transition-colors hover:border-forest hover:text-forest"
    >
      <Moon size={15} strokeWidth={1.6} className="dark:hidden" />
      <Sun size={15} strokeWidth={1.6} className="hidden dark:block" />
    </button>
  );
}
