// Theme-aware colours for SVG attributes and inline styles (charts, graphs). They resolve through the
// CSS variables in globals.css, so they follow the light/dark class without any React state.
export const C = {
  ink: "rgb(var(--ink))",
  mute: "rgb(var(--mute))",
  rule: "rgb(var(--rule))",
  ivory: "rgb(var(--ivory))",
  paper: "rgb(var(--paper))",
  forest: "rgb(var(--forest))",
  mint: "rgb(var(--mint))",
  deep: "rgb(var(--deep))",
  snow: "rgb(var(--snow))",
  faint: "rgb(var(--faint))",
} as const;

export const TOOLTIP_STYLE = {
  background: "rgb(var(--paper) / 0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgb(var(--rule))",
  borderRadius: 12,
  fontSize: 12,
  color: "rgb(var(--ink))",
} as const;
