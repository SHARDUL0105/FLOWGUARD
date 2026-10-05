/** Faint grid behind a section; colours follow the theme tokens. */
export default function GridBackground({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} style={{ backgroundImage: "linear-gradient(rgb(var(--rule) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--rule) / 0.6) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />;
}
