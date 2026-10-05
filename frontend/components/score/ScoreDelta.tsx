"use client";
import NumberTicker from "@/components/effects/NumberTicker";
import { scoreColor } from "./ResilienceGauge";

/** Big "84 -> 32" readout. The second number counts up/down to its value. */
export default function ScoreDelta({ from, to, caption, size = "lg" }: { from: number; to: number; caption?: string; size?: "lg" | "md" }) {
  const color = scoreColor(to);
  const cls = size === "lg" ? "text-[clamp(64px,10vw,128px)]" : "text-[clamp(52px,7vw,96px)]";
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className={`num flex items-baseline gap-4 font-extralight leading-none ${cls}`}>
        <span className="text-mute/60">{from}</span>
        <span className="text-mute/60">→</span>
        <span style={{ color }}><NumberTicker value={to} /></span>
      </div>
      {caption && <div className="mb-2 text-[13px] font-medium" style={{ color }}>{caption}</div>}
    </div>
  );
}
