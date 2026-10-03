// Owner: Shardul. Zustand store: topology, 30-tick history per node, checkout, events, analysis, mode.
import { create } from "zustand";
import type { Topology, TickMessage, Analysis } from "@/lib/types";
interface S { topology: Topology | null; last: TickMessage | null; analysis: Analysis | null; mode: "live" | "replay";
  setTopology: (t: Topology) => void; pushTick: (m: TickMessage) => void; setMode: (m: "live" | "replay") => void; }
export const useStore = create<S>((set) => ({
  topology: null, last: null, analysis: null, mode: "live",
  setTopology: (topology) => set({ topology }),
  pushTick: (last) => set({ last, analysis: last.analysis }),
  setMode: (mode) => set({ mode }),
}));
