"use client";
import { memo, useEffect, useRef, useState } from "react";
import { STATUS_COLOR, STATUS_ON_GREEN, worst } from "@/lib/colors";
import { NODE_POSITIONS, SERVICE_LABEL, TOPOLOGY } from "@/lib/mock";
import type { NodeStatus } from "@/lib/types";
import { C } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props {
  statuses?: Record<string, NodeStatus>;
  values?: Record<string, string>;
  tone?: "light" | "green";
  labels?: boolean;
  particles?: boolean;
  /** hold all motion (used while the hero scene is hidden) */
  paused?: boolean;
  className?: string;
}

const FLOW = { healthy: { n: 2, dur: 4.2 }, degraded: { n: 3, dur: 2.2 }, critical: { n: 4, dur: 1.1 } } as const;
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};

/** Quiet line-drawing of the service ecosystem. Used in the hero, cards and overview pages. */
function MiniGraphInner({ statuses = {}, values = {}, tone = "light", labels = true, particles = true, paused = false, className }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el?.pauseAnimations) return;
    if (paused || !visible) el.pauseAnimations(); else el.unpauseAnimations();
  }, [paused, visible, statuses]);
  const green = tone === "green";
  const ink = green ? C.snow : C.ink;
  const fill = green ? C.deep : C.paper;
  const colors = green ? STATUS_ON_GREEN : STATUS_COLOR;
  const st = (id: string): NodeStatus => statuses[id] ?? "healthy";

  return (
    <svg ref={ref} viewBox="-80 10 1260 400" className={cn("h-auto w-full", className)} role="img" aria-label="Service dependency graph">
      {TOPOLOGY.edges.map((e) => {
        const a = NODE_POSITIONS[e.source], b = NODE_POSITIONS[e.target];
        const d = curve(a, b);
        const s = worst(st(e.source), st(e.target));
        const f = FLOW[s];
        return (
          <g key={`${e.source}-${e.target}`}>
            <path d={d} fill="none" stroke={s === "healthy" ? ink : colors[s]} strokeOpacity={s === "healthy" ? 0.22 : 0.7} strokeWidth={1.2} />
            {particles && (
              <g key={s}>
                {Array.from({ length: f.n }).map((_, i) => (
                  <circle key={i} r={3.2} fill={s === "healthy" ? colors.healthy : colors[s]}>
                    <animateMotion dur={`${f.dur}s`} begin={`${-(i * f.dur) / f.n}s`} repeatCount="indefinite" path={d} />
                  </circle>
                ))}
              </g>
            )}
          </g>
        );
      })}
      {TOPOLOGY.nodes.map((n) => {
        const p = NODE_POSITIONS[n.id];
        const s = st(n.id);
        const c = s === "healthy" ? ink : colors[s];
        return (
          <g key={n.id}>
            {s !== "healthy" && (
              <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={colors[s]} strokeWidth={1.2}>
                <animate attributeName="r" values="12;34" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.7;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={p.x} cy={p.y} r={s === "healthy" ? 9 : 11} fill={s === "healthy" ? fill : colors[s]} stroke={c} strokeWidth={1.5} style={{ transition: "all .6s ease" }} />
            {labels && (
              <>
                <text x={p.x} y={p.y - 26} textAnchor="middle" fill={ink} style={{ fontSize: 21, fontWeight: 500 }}>{SERVICE_LABEL[n.id]}</text>
                {values[n.id] && (
                  <text x={p.x} y={p.y + 40} textAnchor="middle" fill={s === "healthy" ? ink : colors[s]} fillOpacity={s === "healthy" ? 0.6 : 1} className="num" style={{ fontSize: 18 }}>{values[n.id]}</text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
export default memo(MiniGraphInner);
