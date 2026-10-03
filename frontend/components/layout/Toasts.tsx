"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STATUS_COLOR } from "@/lib/colors";
import { SERVICE_LABEL } from "@/lib/mock";
import type { NodeStatus } from "@/lib/types";
import { useFlowStore } from "@/store/flowguardStore";

interface Toast { id: string; node: string; msg: string; status: NodeStatus }

/** Small floating notices for new anomalies. They fade on their own and never block the page. */
export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);
  const seen = useRef(0);

  useEffect(() => {
    const unsub = useFlowStore.subscribe((s) => {
      if (s.events.length === 0) { seen.current = 0; return; }
      const fresh = s.events.slice(0, Math.max(0, s.events.length - seen.current));
      seen.current = s.events.length;
      fresh.forEach((e) => {
        const status = s.nodes[e.node]?.status ?? "degraded";
        const t: Toast = { id: `${e.t}-${e.node}-${Math.random().toString(36).slice(2, 6)}`, node: e.node, msg: e.msg, status };
        setItems((cur) => [t, ...cur].slice(0, 3));
        setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 6500);
      });
    });
    return unsub;
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[300px] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex gap-3 glass-strong rounded-xl p-3"
          >
            <span className="mt-1 h-8 w-[3px] shrink-0" style={{ background: STATUS_COLOR[t.status] }} />
            <div className="text-[12.5px] leading-snug">
              <div className="font-medium text-ink">{SERVICE_LABEL[t.node]} is {t.status === "critical" ? "critical" : "degraded"}</div>
              <div className="text-mute">{t.msg}. <Link href="/alerts" className="text-forest underline underline-offset-2">View alerts</Link></div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
