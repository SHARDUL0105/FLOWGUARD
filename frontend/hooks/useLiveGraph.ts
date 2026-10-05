"use client";
import { useFlowStore } from "@/store/flowguardStore";

/** Data-source control for the graph: "live" streams /ws from the backend, "replay" plays recorded fixtures.
 *  Asking for live while the backend is off silently lands on replay, so the demo never breaks. */
export function useLiveGraph() {
  const mode = useFlowStore((s) => s.mode);
  const setMode = useFlowStore((s) => s.setMode);
  return { mode, setMode };
}
