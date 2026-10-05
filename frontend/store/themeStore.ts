"use client";
import { create } from "zustand";

export type Theme = "light" | "dark";
export const THEME_KEY = "fg-theme";

interface ThemeState { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }

const apply = (t: Theme) => {
  document.documentElement.classList.toggle("dark", t === "dark");
  try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode: the choice just won't persist */ }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  setTheme: (t) => { apply(t); set({ theme: t }); },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
