import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    bg: "#070B14", healthy: "#22D3EE", degraded: "#F59E0B", critical: "#EF4444", accent: "#8B5CF6" },
    fontFamily: { sans: ["Inter", "system-ui"], mono: ["JetBrains Mono", "monospace"] } } },
  plugins: [],
};
export default config;
