"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Glass card with a soft glow that follows the cursor. */
export default function GlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={cn("glass relative overflow-hidden rounded-2xl", className)}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); ref.current!.style.setProperty("--gx", `${e.clientX - r.left}px`); ref.current!.style.setProperty("--gy", `${e.clientY - r.top}px`); }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100" style={{ background: "radial-gradient(240px circle at var(--gx,50%) var(--gy,50%), rgb(var(--forest) / 0.12), transparent 70%)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}
