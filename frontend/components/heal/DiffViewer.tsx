"use client";
import { motion } from "framer-motion";

/** Unified diff with red/green lines, revealed line by line. */
export default function DiffViewer({ diff, title = "Generated patch" }: { diff: string; title?: string }) {
  const lines = diff.split("\n");
  return (
    <div>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <div className="num glass mt-3 overflow-x-auto rounded-xl py-3 text-[12.5px] leading-6">
        {lines.map((l, i) => {
          const add = l.startsWith("+") && !l.startsWith("+++"), del = l.startsWith("-") && !l.startsWith("---"), hunk = l.startsWith("@@");
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }}
              className={`whitespace-pre px-5 ${add ? "bg-ok/10 text-ok" : del ? "bg-crit/10 text-crit" : hunk ? "text-forest" : "text-mute"}`}>
              {l || " "}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
