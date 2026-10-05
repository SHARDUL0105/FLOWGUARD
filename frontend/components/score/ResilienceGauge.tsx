"use client";
import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { STATUS_COLOR } from "@/lib/colors";

export const scoreColor = (v: number) => (v >= 80 ? STATUS_COLOR.healthy : v >= 50 ? STATUS_COLOR.degraded : STATUS_COLOR.critical);

/** 270-degree radial gauge, 0-100. Sweeps from its previous value (or `from`) to `value`. */
export default function ResilienceGauge({ value, from, size = 180, label = "Resilience", duration = 1.6 }: { value: number; from?: number; size?: number; label?: string; duration?: number }) {
  const [v, setV] = useState(from ?? value);
  const prev = useRef(from ?? value);
  useEffect(() => {
    const c = animate(prev.current, value, { duration, ease: "easeInOut", onUpdate: setV });
    prev.current = value;
    return () => c.stop();
  }, [value, duration]);
  const r = size / 2 - 12, circ = 2 * Math.PI * r, arc = 0.75 * circ;
  const color = scoreColor(v);
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label} ${Math.round(v)} out of 100`}>
      <svg width={size} height={size} className="-rotate-[225deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--rule))" strokeWidth={9} strokeLinecap="round" strokeDasharray={`${arc} ${circ}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(arc * v) / 100} ${circ}`} style={{ filter: `drop-shadow(0 0 6px ${color}55)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num font-light leading-none" style={{ fontSize: size * 0.3, color }}>{Math.round(v)}</span>
        <span className="mt-1 text-[11px] text-mute">{label}</span>
      </div>
    </div>
  );
}
