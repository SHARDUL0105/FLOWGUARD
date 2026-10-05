"use client";
import { useState } from "react";
import { useLiveGraph } from "@/hooks/useLiveGraph";
import { cn } from "@/lib/utils";

export default function DemoModeToggle() {
  const { mode, setMode } = useLiveGraph();
  const [note, setNote] = useState("");
  const pick = async (m: "live" | "replay") => {
    const used = await setMode(m);
    setNote(m === "live" && used === "replay" ? "Backend offline, using replay" : "");
  };
  return (
    <div className="flex items-center gap-3">
      <div className="glass flex rounded-full p-0.5 text-[12px]" role="group" aria-label="Data source">
        {(["live", "replay"] as const).map((m) => (
          <button key={m} onClick={() => pick(m)} aria-pressed={mode === m}
            className={cn("rounded-full px-3.5 py-1 capitalize transition-colors", mode === m ? "bg-forest text-paper" : "text-mute hover:text-ink")}>{m}</button>
        ))}
      </div>
      {note && <span className="text-[11.5px] text-warn">{note}</span>}
    </div>
  );
}
