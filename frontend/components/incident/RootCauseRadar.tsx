"use client";
import { motion } from "framer-motion";
import { SERVICE_LABEL } from "@/lib/mock";
import { useFlowStore } from "@/store/flowguardStore";
import { Block } from "@/components/command-center/Panels";

const ANGLE: Record<string, number> = { database: 0, payment: 60, inventory: 120, order: 180, gateway: 240, frontend: 300 };

/** Rotating radar sweep that locks onto the top root-cause candidate, with a ranked confidence list. */
export default function RootCauseRadar() {
  const a = useFlowStore((s) => s.analysis);
  const top = a?.root_cause[0];
  const locked = top ? ANGLE[top.node] ?? 0 : 0;
  const R = 62;
  const pos = (deg: number, r: number) => [80 + r * Math.sin((deg * Math.PI) / 180), 80 - r * Math.cos((deg * Math.PI) / 180)];
  return (
    <Block title="Likely origin" aside="confidence estimate">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 160 160" className="h-[132px] w-[132px] shrink-0" role="img" aria-label="Root cause radar">
          {[20, 41, 62].map((r) => <circle key={r} cx="80" cy="80" r={r} fill="none" stroke="rgb(var(--rule))" />)}
          <line x1="80" y1="18" x2="80" y2="142" stroke="rgb(var(--rule))" /><line x1="18" y1="80" x2="142" y2="80" stroke="rgb(var(--rule))" />
          <motion.g key={top?.node ?? "scan"} style={{ originX: "80px", originY: "80px" }}
            animate={top ? { rotate: locked } : { rotate: 360 }} initial={{ rotate: top ? locked - 220 : 0 }}
            transition={top ? { duration: 1.1, ease: "easeOut" } : { duration: 4, repeat: Infinity, ease: "linear" }}>
            <path d="M80 80 L80 18 A62 62 0 0 1 112 26 Z" fill="rgb(var(--forest) / 0.18)" /><line x1="80" y1="80" x2="80" y2="18" stroke="rgb(var(--forest))" strokeWidth="1.5" />
          </motion.g>
          {a?.root_cause.slice(0, 4).map((c, i) => { const [x, y] = pos(ANGLE[c.node] ?? 0, R * (0.55 + 0.1 * i)); return (
            <circle key={c.node} cx={x} cy={y} r={i === 0 ? 5 : 3} fill={i === 0 ? "#D94B45" : "rgb(var(--mute))"}>{i === 0 && <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />}</circle>); })}
        </svg>
        <div className="min-w-0 flex-1">
          {!a ? <p className="text-[12.5px] text-mute">No anomaly. Start a fault and the radar locks onto the origin.</p> : (
            <ul className="space-y-2.5">
              {a.root_cause.slice(0, 3).map((c, i) => (
                <li key={c.node}>
                  <div className="flex items-baseline justify-between text-[13px]"><span className={i === 0 ? "font-semibold" : "text-ink/70"}>{SERVICE_LABEL[c.node]}</span><span className="num text-mute">{Math.round(c.confidence * 100)}%</span></div>
                  <div className="mt-1 h-1 rounded-full bg-rule"><div className="h-1 rounded-full bg-forest transition-all duration-700" style={{ width: `${c.confidence * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {top && <p className="mt-2 text-[11.5px] text-mute">{top.evidence.join(". ")}.</p>}
    </Block>
  );
}
