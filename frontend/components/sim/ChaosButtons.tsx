"use client";
import { useEffect } from "react";
import type { ScenarioId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/store/flowguardStore";

const ITEMS: { id: ScenarioId | "reset"; label: string; key: string }[] = [
  { id: "db_latency", label: "Database slowdown", key: "1" },
  { id: "service_down", label: "Inventory down", key: "2" },
  { id: "traffic_spike", label: "Traffic spike", key: "3" },
  { id: "reset", label: "Reset", key: "0" },
];

export default function ChaosButtons({ hotkeys = false, className }: { hotkeys?: boolean; className?: string }) {
  const fireFault = useFlowStore((s) => s.fire);
  const reset = useFlowStore((s) => s.reset);
  const scenario = useFlowStore((s) => s.scenario);
  const fire = (id: ScenarioId | "reset") => (id === "reset" ? reset() : void fireFault(id));

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const hit = ITEMS.find((i) => i.key === e.key);
      if (hit) fire(hit.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotkeys]);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ITEMS.map(({ id, label, key }) => {
        const active = id === scenario;
        return (
          <button
            key={id}
            onClick={() => fire(id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] transition-colors duration-300",
              active ? "border-crit bg-crit/10 text-crit" : id === "reset" ? "border-ink/15 text-mute hover:border-ink hover:text-ink" : "border-ink/20 text-ink hover:border-forest hover:text-forest",
            )}
          >
            {label}
            {hotkeys && <kbd className="num text-[10px] text-mute">{key}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
