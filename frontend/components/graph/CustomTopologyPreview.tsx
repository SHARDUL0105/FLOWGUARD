"use client";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { C } from "@/lib/theme";

interface TopoNode { id: string; label: string; x: number; y: number; type?: string }
interface TopoEdge { id: string; source: string; target: string }

interface Props {
  nodes: TopoNode[];
  edges: TopoEdge[];
  className?: string;
}

const KIND_COLOR: Record<string, string> = {
  service:  "#218B6A",
  database: "#C9851F",
  cache:    "#5B8BD0",
  gateway:  "#9C71C0",
  queue:    "#D94B45",
  external: "#6B7280",
};

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};

/** Renders a user-defined custom topology as an animated SVG preview (same visual language as MiniGraph). */
function CustomTopologyPreviewInner({ nodes, edges, className }: Props) {
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
    if (!visible) el.pauseAnimations(); else el.unpauseAnimations();
  }, [visible]);

  if (!nodes.length) return null;

  // Compute viewBox from node positions with padding
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const pad = 80;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const height = Math.max(...ys) - minY + pad * 2;

  const pos: Record<string, { x: number; y: number }> = {};
  nodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y }; });

  return (
    <svg
      ref={ref}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Custom topology graph"
    >
      {/* Edges */}
      {edges.map(e => {
        const a = pos[e.source], b = pos[e.target];
        if (!a || !b) return null;
        const d = curve(a, b);
        return (
          <g key={e.id}>
            <path d={d} fill="none" stroke={C.ink} strokeOpacity={0.2} strokeWidth={1.5} />
            {[0, 1, 2].map(i => (
              <circle key={i} r={3} fill={C.ink} fillOpacity={0.45}>
                <animateMotion dur="3.6s" begin={`${-(i * 1.2)}s`} repeatCount="indefinite" path={d} />
              </circle>
            ))}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(n => {
        const p = pos[n.id];
        const color = KIND_COLOR[n.type ?? "service"] ?? KIND_COLOR.service;
        return (
          <g key={n.id}>
            {/* Glow ring */}
            <circle cx={p.x} cy={p.y} r={18} fill={color} fillOpacity={0.12} />
            {/* Main dot */}
            <circle cx={p.x} cy={p.y} r={11} fill={C.paper} stroke={color} strokeWidth={2} />
            {/* Label */}
            <text
              x={p.x}
              y={p.y - 22}
              textAnchor="middle"
              fill={C.ink}
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default memo(CustomTopologyPreviewInner);
