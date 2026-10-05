"use client";
import type { WhatIfResponse } from "@/lib/types";

const RISK = { LOW: "#218B6A", MEDIUM: "#C9851F", HIGH: "#D94B45" } as const;

/** Paired forecast / measured bars with accuracy and risk badges and the honest note. */
export default function PredVsMeasured({ r }: { r: WhatIfResponse }) {
  const max = Math.max(r.predicted.p95_ms, r.measured.p95_ms, 1);
  const bar = (label: string, v: number, color: string) => (
    <div className="grid grid-cols-[68px_1fr_56px] items-center gap-2 text-[11.5px]">
      <span className="text-mute">{label}</span>
      <div className="h-2 rounded-full bg-rule"><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
      <span className="num text-right">{v} ms</span>
    </div>
  );
  return (
    <div className="space-y-2">
      {bar("Forecast", r.predicted.p95_ms, "rgb(var(--faint))")}
      {bar("Measured", r.measured.p95_ms, "rgb(var(--forest))")}
      <div className="flex items-center gap-3 pt-1 text-[11.5px]">
        <span className="glass rounded-full px-2.5 py-0.5">accuracy <span className="num font-semibold">{Math.round(r.accuracy * 100)}%</span></span>
        <span className="rounded-full border px-2.5 py-0.5 font-semibold" style={{ color: RISK[r.predicted.risk], borderColor: RISK[r.predicted.risk] }}>{r.predicted.risk} risk</span>
      </div>
      {r.note && <p className="border-l-2 border-warn pl-3 text-[11.5px] text-ink/80">{r.note}</p>}
    </div>
  );
}
