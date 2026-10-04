import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF7",
        ivory: "#F3F3ED",
        ink: "#101412",
        forest: { DEFAULT: "#0B4F3A", 2: "#145F49" },
        mint: "#DCEFE7",
        mute: "#6E756F",
        rule: "#E6E8E3",
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
