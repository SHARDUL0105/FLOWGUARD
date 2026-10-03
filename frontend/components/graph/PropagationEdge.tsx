"use client";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { Edge, EdgeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { C } from "@/lib/theme";
import { STATUS_COLOR, worst } from "@/lib/colors";
import { useFlowStore } from "@/store/flowguardStore";

export type PropagationEdgeData = { timeout_ms: number | null; retries: number; breaker: boolean; fallback: boolean };

// particles per edge, seconds per traversal
const FLOW = {
  healthy: { n: 3, dur: 3.6, r: 2 },
  degraded: { n: 4, dur: 1.9, r: 2.3 },
  critical: { n: 6, dur: 0.85, r: 2.6 },
} as const;

function PropagationEdgeInner({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<PropagationEdgeData>>) {
  const a = useFlowStore((s) => s.nodes[source]?.status ?? "healthy");
  const b = useFlowStore((s) => s.nodes[target]?.status ?? "healthy");
  const status = worst(a, b);
  const color = STATUS_COLOR[status];
  const f = FLOW[status];
  const [hover, setHover] = useState(false);
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: status === "healthy" ? C.ink : color, strokeOpacity: status === "healthy" ? 0.2 : 0.55, strokeWidth: 1.2 }} />
      {/* particles: key on status so the animation restarts at the new speed */}
      <g key={`${id}-${status}`} pointerEvents="none">
        {Array.from({ length: f.n }).map((_, i) => (
          <circle key={i} r={f.r} fill={color} opacity={0.95}>
            <animateMotion
              dur={`${f.dur * (status === "critical" ? 0.85 + ((i * 37) % 30) / 100 : 1)}s`}
              begin={`${-(i * f.dur) / f.n}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        ))}
      </g>
      <path d={path} fill="none" stroke="transparent" strokeWidth={18} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} />
      {hover && data && (
        <EdgeLabelRenderer>
          <div
            className="num pointer-events-none absolute border border-rule bg-paper px-2 py-1 text-[11px] text-ink shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            timeout {data.timeout_ms ?? "none"}
            {data.timeout_ms ? " ms" : ""} / retries {data.retries}
            {data.breaker ? " / breaker" : ""}
            {data.fallback ? " / fallback" : ""}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(PropagationEdgeInner);
