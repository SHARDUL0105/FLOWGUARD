"use client";
import { AnimatePresence, motion } from "framer-motion";
import { STATUS_COLOR } from "@/lib/colors";
import { useFlowStore } from "@/store/flowguardStore";

export default function StatusTicker() {
  const events = useFlowStore((s) => s.events);
  const nodes = useFlowStore((s) => s.nodes);
  return (
    <div className="glass flex h-10 items-center gap-5 overflow-hidden rounded-none border-x-0 border-b-0 px-6 text-[12px]">
      <span className="shrink-0 text-mute">Event log</span>
      {events.length === 0 ? (
        <span className="text-mute/80">Nothing abnormal. Start a fault to watch it spread.</span>
      ) : (
        <div className="flex min-w-0 items-center gap-7 overflow-hidden whitespace-nowrap">
          <AnimatePresence initial={false}>
            {events.slice(0, 6).map((e) => (
              <motion.span key={`${e.t}-${e.node}-${e.kind}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="flex items-center gap-2">
                <span className="num text-mute">t+{e.t}s</span>
                <span style={{ color: STATUS_COLOR[nodes[e.node]?.status ?? "degraded"] }}>{e.msg}</span>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
