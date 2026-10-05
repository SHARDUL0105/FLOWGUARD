"use client";
import { create } from "zustand";
import { api } from "@/lib/api";
import { FAULT_AT, TOPOLOGY, healthySeed, loadRun } from "@/lib/mock";
import { connect } from "@/lib/ws";
import type { Analysis, CheckoutMetrics, FlowEvent, Mode, NodeMetrics, ScenarioId, TickMessage, Topology } from "@/lib/types";

const HISTORY = 30;
const MAX_EVENTS = 60;
let timer: ReturnType<typeof setInterval> | null = null;
const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
let closeWs: (() => void) | null = null;
const dropWs = () => { closeWs?.(); closeWs = null; };

interface FlowState {
  topology: Topology;
  nodes: Record<string, NodeMetrics>;
  history: Record<string, number[]>;
  checkout: CheckoutMetrics;
  events: FlowEvent[];
  analysis: Analysis | null;
  t: number;
  scenario: ScenarioId | null;
  severity: number;
  mode: Mode;
  running: boolean;
  runId: number;
  activeProjectId?: string;
  setTopology: (topology: Topology) => void;
  loadProjectTopology: (projectId: string) => Promise<void>;
  ingest: (m: TickMessage) => void;
  startMock: (scenario: ScenarioId, severity?: number) => Promise<void>;
  /** Switch data source. Live falls back to replay if the backend is unreachable. Returns the mode actually used. */
  setMode: (mode: Mode) => Promise<Mode>;
  fire: (scenario: ScenarioId, severity?: number) => Promise<void>;
  reset: () => void;
}

const seed = healthySeed();
const initial = () => ({
  nodes: seed.nodes, history: seed.history, checkout: seed.checkout,
  events: [] as FlowEvent[], analysis: null as Analysis | null, t: 0, scenario: null as ScenarioId | null, severity: 1, running: false,
});

export const useFlowStore = create<FlowState>((set, get) => ({
  topology: TOPOLOGY,
  ...initial(),
  mode: "replay",
  runId: 0,

  setTopology: (topo) => {
    // Generate healthy node metrics seed for all nodes in the topology
    const nodes: Record<string, NodeMetrics> = {};
    const history: Record<string, number[]> = {};
    for (const n of topo.nodes) {
      nodes[n.id] = { status: "healthy", p95_ms: n.base_ms ?? 50, error_rate: 0, load_rps: n.capacity_rps ? n.capacity_rps * 0.2 : 100, utilization: 0.2 };
      history[n.id] = [n.base_ms ?? 50, n.base_ms ?? 50, n.base_ms ?? 50];
    }
    set({ topology: topo, nodes, history });
  },

  loadProjectTopology: async (projectId: string) => {
    set({ activeProjectId: projectId });
    try {
      const topo = await api.getTopology(projectId);
      if (topo && topo.nodes && topo.nodes.length > 0) {
        const formattedNodes = topo.nodes.map((n: any) => ({
          id: n.id,
          label: n.label || n.id,
          layer: n.layer ?? 0,
          base_ms: n.base_ms ?? 50,
          capacity_rps: n.capacity_rps ?? 500,
          x: n.x,
          y: n.y,
          type: n.type,
        }));
        const formattedEdges = (topo.edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
          timeout_ms: e.timeout_ms ?? 700,
          retries: e.retries ?? 1,
          breaker: e.breaker ?? true,
          fallback: e.fallback ?? false,
        }));
        get().setTopology({ nodes: formattedNodes, edges: formattedEdges });
      } else {
        get().setTopology(TOPOLOGY);
      }
    } catch {
      get().setTopology(TOPOLOGY);
    }
  },

  ingest: (m) =>
    set((s) => {
      const history: Record<string, number[]> = {};
      for (const id of Object.keys(m.nodes)) history[id] = [...(s.history[id] ?? []), m.nodes[id].p95_ms].slice(-HISTORY);
      return {
        nodes: m.nodes, history, checkout: m.checkout, t: m.t, scenario: m.scenario, severity: m.severity,
        analysis: m.analysis,
        events: m.events.length ? [...m.events.slice().reverse(), ...s.events].slice(0, MAX_EVENTS) : s.events,
      };
    }),

  startMock: async (scenario, severity) => {
    stop();
    set({ ...initial(), runId: get().runId + 1 });
    const ticks = await loadRun(scenario, severity);
    let i = Math.max(0, FAULT_AT - 3); // three calm ticks of lead-in, then the fault
    set({ running: true, scenario });
    const step = () => {
      if (i >= ticks.length) { stop(); set({ running: false }); return; }
      get().ingest(ticks[i++]);
    };
    step();
    timer = setInterval(step, 1000);
  },

  setMode: async (mode) => {
    stop(); dropWs();
    if (mode === "live") {
      try {
        await api.health();
        await api.setMode("live");
        await api.reset();
        set({ ...initial(), mode: "live", runId: get().runId + 1 });
        closeWs = connect((m) => get().ingest(m));
        return "live";
      } catch { /* backend off: fall through to replay */ }
    } else {
      api.setMode("replay").catch(() => {});
    }
    set({ ...initial(), mode: "replay", runId: get().runId + 1 });
    return "replay";
  },

  fire: async (scenario, severity) => {
    if (get().mode === "live") {
      try { set({ ...initial(), mode: "live", runId: get().runId + 1 }); await api.chaos(scenario, severity); set({ scenario, running: true }); return; }
      catch { await get().setMode("replay"); }
    }
    await get().startMock(scenario, severity);
  },

  reset: () => {
    stop();
    if (get().mode === "live") api.reset().catch(() => {});
    set({ ...initial(), runId: get().runId + 1 });
  },
}));
