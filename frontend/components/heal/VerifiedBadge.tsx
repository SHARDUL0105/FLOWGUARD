"use client";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

const LABEL = { db_latency: "Database latency", service_down: "Service down", traffic_spike: "Traffic spike" } as Record<string, string>;

export default function VerifiedBadge({ faults = ["db_latency", "service_down", "traffic_spike"] }: { faults?: string[] }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 rounded-xl border border-ok/50 bg-mint/70 px-4 py-3 text-forest backdrop-blur-md"
      style={{ boxShadow: "0 0 32px rgba(33,139,106,0.35)" }}>
      <ShieldCheck size={26} strokeWidth={1.6} />
      <div>
        <div className="text-[14px] font-semibold">Verified under {faults.length} faults</div>
        <div className="mt-0.5 text-[12px]">{faults.map((f) => LABEL[f] ?? f).join(", ")}. Patch accepted.</div>
      </div>
    </motion.div>
  );
}
