import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        ivory: "rgb(var(--ivory) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        forest: { DEFAULT: "rgb(var(--forest) / <alpha-value>)", 2: "rgb(var(--forest-2) / <alpha-value>)" },
        deep: "rgb(var(--deep) / <alpha-value>)",
        snow: "rgb(var(--snow) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        mute: "rgb(var(--mute) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        ok: "#218B6A",
        warn: "#C9851F",
        crit: "#D94B45",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
