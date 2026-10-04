"use client";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { memo } from "react";
import NumberTicker from "@/components/effects/NumberTicker";
import { STATUS_COLOR, STATUS_WORD } from "@/lib/colors";
import { useFlowStore } from "@/store/flowguardStore";

export type ServiceNodeData = { sid: string; label: string; layer: number; baseMs: number };

function Sparkline({ values, color, base }: { values: number[]; color: string; base: number }) {
  const W = 150, H = 24;
  if (values.length < 2) return <svg width={W} height={H} />;
  const max = Math.max(...values, base * 2);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 2 - (v / max) * (H - 4)]);
  const baseY = H - 2 - ((base * 1.5) / max) * (H - 4);
  const last = pts[pts.length - 1];
  return (
    <svg width={W} height={H} className="block overflow-visible">
      <line x1="0" x2={W} y1={baseY} y2={baseY} stroke="#101412" strokeOpacity="0.14" strokeDasharray="2 3" />
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.3" fill={color} />
    </svg>
  );
}

function ServiceNodeInner({ data }: NodeProps<Node<ServiceNodeData>>) {
  const m = useFlowStore((s) => s.nodes[data.sid]);
  const hist = useFlowStore((s) => s.history[data.sid]) ?? [];
  const isRoot = useFlowStore((s) => s.analysis?.root_cause[0]?.node === data.sid);
  const runId = useFlowStore((s) => s.runId);
  const status = m?.status ?? "healthy";
  const color = STATUS_COLOR[status];
  const calm = status === "healthy";

  return (
    <motion.div
      className="relative w-[196px] border bg-paper px-3.5 pb-2.5 pt-3"
      style={{ borderColor: calm ? "#E6E8E3" : color }}
      animate={
        status === "critical"
          ? { x: [0, -1, 1, -0.5, 0], boxShadow: [`0 0 0 0 ${color}00`, `0 0 0 6px ${color}22`, `0 0 0 0 ${color}00`] }
          : status === "degraded"
          ? { x: 0, boxShadow: [`0 0 0 0 ${color}00`, `0 0 0 5px ${color}1f`, `0 0 0 0 ${color}00`] }
          : { x: 0, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
      }
      transition={status === "critical" ? { duration: 1.6, repeat: Infinity } : status === "degraded" ? { duration: 2.6, repeat: Infinity } : { duration: 0.5 }}
    >
      {isRoot && !calm && (
        <motion.span
          key={`${runId}-${data.sid}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 border"
          style={{ borderColor: color }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 2, ease: "easeOut", repeat: 2, repeatDelay: 0.6 }}
        />
      )}
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{data.label}</span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {STATUS_WORD[status]}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <NumberTicker value={m?.p95_ms ?? 0} className="text-[26px] font-light leading-none text-ink" />
        <span className="text-[11px] text-mute">ms p95</span>
      </div>
      <div className="mt-2"><Sparkline values={hist} color={color} base={data.baseMs} /></div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-mute">
        <span className="num">{(m?.load_rps ?? 0).toFixed(0)} req/s</span>
        <span className="num" style={{ color: (m?.utilization ?? 0) >= 0.95 ? STATUS_COLOR.critical : undefined }}>{Math.round((m?.utilization ?? 0) * 100)}% busy</span>
        <span className="num">{((m?.error_rate ?? 0) * 100).toFixed(1)}% err</span>
      </div>
    </motion.div>
  );
}
export default memo(ServiceNodeInner);
