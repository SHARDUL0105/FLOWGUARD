"use client";
import { motion } from "framer-motion";
import { STATUS_COLOR } from "@/lib/colors";
import { SERVICE_LABEL } from "@/lib/mock";
import { useFlowStore } from "@/store/flowguardStore";
import { Block } from "@/components/command-center/Panels";

/** Chips that light up one after another along the propagation path. */
export default function CascadePath() {
  const a = useFlowStore((s) => s.analysis);
  const nodes = useFlowStore((s) => s.nodes);
  const runId = useFlowStore((s) => s.runId);
  return (
    <Block title="Cascade path" aside={a ? `${a.blast_radius.total} services in the blast radius` : undefined}>
      {!a ? <p className="text-[12.5px] text-mute">Nothing is spreading.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {a.propagation_path.map((n, i) => (
              <motion.span key={`${runId}-${n}`} initial={{ opacity: 0.25 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.5 }} className="flex items-center gap-2">
                <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[nodes[n]?.status ?? "degraded"] }} />{SERVICE_LABEL[n]}</span>
                {i < a.propagation_path.length - 1 && <span className="text-mute">→</span>}
              </motion.span>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-mute">Direct: {a.blast_radius.direct.map((n) => SERVICE_LABEL[n]).join(", ") || "none"}. Downstream: {a.blast_radius.downstream.map((n) => SERVICE_LABEL[n]).join(", ") || "none"}.{a.blast_radius.checkout_at_risk ? " Checkout at risk." : ""}</p>
        </>
      )}
    </Block>
  );
}
