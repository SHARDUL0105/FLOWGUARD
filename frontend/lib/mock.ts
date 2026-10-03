// Mock data layer. Order of preference:
//   1) recorded fixtures at /fixtures/run.<scenario>.json (copy ../fixtures/*.json into public/fixtures)
//   2) a TypeScript port of the Appendix A simulator, so the UI works with no backend and no fixtures.
// The port uses its own seeded PRNG, so exact numbers differ slightly from Python; shapes are identical.
import type { Analysis, FlowEvent, NodeMetrics, NodeStatus, ScenarioId, TickMessage, Topology, TopologyEdge } from "./types";

export const FAULT_AT = 10;
export const DEFAULT_SEVERITY: Record<ScenarioId, number> = { db_latency: 3.0, service_down: 1.0, traffic_spike: 2.0 };
export const SERVICE_LABEL: Record<string, string> = {
  frontend: "Frontend", gateway: "Gateway", order: "Order", inventory: "Inventory", payment: "Payment", database: "Database",
};

const SERVICES: Record<string, { base: number; cap: number; layer: number }> = {
  frontend: { base: 20, cap: 500, layer: 0 },
  gateway: { base: 15, cap: 400, layer: 1 },
  order: { base: 40, cap: 250, layer: 2 },
  inventory: { base: 30, cap: 250, layer: 3 },
  payment: { base: 60, cap: 200, layer: 3 },
  database: { base: 10, cap: 600, layer: 4 },
};
const ORDER = ["frontend", "gateway", "order", "inventory", "payment", "database"];
const DOWNSTREAM: Record<string, string[]> = {
  frontend: ["gateway"], gateway: ["order"], order: ["inventory", "payment"],
  inventory: ["database"], payment: ["database"], database: [],
};
const NO_TIMEOUT = 30000;
const BASE_LOAD = 100;

export const TOPOLOGY: Topology = {
  nodes: ORDER.map((id) => ({
    id, label: SERVICE_LABEL[id], layer: SERVICES[id].layer, base_ms: SERVICES[id].base, capacity_rps: SERVICES[id].cap,
  })),
  edges: [
    { source: "frontend", target: "gateway", timeout_ms: 3000, retries: 0, breaker: false, fallback: false },
    { source: "gateway", target: "order", timeout_ms: 2500, retries: 0, breaker: false, fallback: false },
    { source: "order", target: "inventory", timeout_ms: 700, retries: 1, breaker: true, fallback: true },
    { source: "order", target: "payment", timeout_ms: 900, retries: 0, breaker: true, fallback: true },
    { source: "inventory", target: "database", timeout_ms: 400, retries: 1, breaker: false, fallback: false },
    { source: "payment", target: "database", timeout_ms: 400, retries: 0, breaker: false, fallback: false },
  ],
};
const EDGE: Record<string, TopologyEdge> = Object.fromEntries(TOPOLOGY.edges.map((e) => [`${e.source}>${e.target}`, e]));

// Fixed canvas positions from Section 11.
export const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  frontend: { x: 0, y: 200 }, gateway: { x: 260, y: 200 }, order: { x: 520, y: 200 },
  inventory: { x: 780, y: 70 }, payment: { x: 780, y: 330 }, database: { x: 1040, y: 200 },
};

// ---------- seeded PRNG ----------
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeGauss(rnd: () => number) {
  return () => {
    let u = 0;
    while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
}

// ---------- simulator port (Appendix A) ----------
interface St { resp: number; succ: number; own: number; rho: number; load: number }

function edgeAttempt(cfg: TopologyEdge, cb: { resp: number; succ: number }): [number, number, number] {
  const R = cb.resp, p = cb.succ;
  const T = cfg.timeout_ms || NO_TIMEOUT;
  if (cfg.breaker && p < 0.5) return [cfg.fallback ? 1 : 0, 2, 0];
  const pAtt = p * (1 - Math.exp(-Math.pow(T / R, 2)));
  const tAtt = Math.min(R, T);
  const q = 1 - pAtt, k = cfg.retries;
  const attempts = q >= 0.999999 ? k + 1 : (1 - Math.pow(q, k + 1)) / (1 - q);
  let succ = 1 - Math.pow(q, k + 1);
  if (cfg.fallback) succ = 1;
  return [succ, tAtt * attempts, attempts];
}

function simulate(fault: ScenarioId | null, severity: number, ticks: number, seed = 7): Record<string, St>[] {
  const gauss = makeGauss(mulberry32(seed));
  let state: Record<string, St> = Object.fromEntries(
    ORDER.map((s) => [s, { resp: SERVICES[s].base, succ: 1, own: SERVICES[s].base, rho: 0, load: 0 }]),
  );
  const out: Record<string, St>[] = [];
  for (let t = -10; t < ticks; t++) {
    const mult: Record<string, number> = Object.fromEntries(ORDER.map((s) => [s, 1]));
    const down = new Set<string>();
    let lm = 1;
    if (fault && t >= FAULT_AT) {
      if (fault === "db_latency") mult.database = severity;
      if (fault === "service_down") down.add("inventory");
      if (fault === "traffic_spike") lm = severity;
    }
    const L0 = BASE_LOAD * lm * (1 + 0.02 * gauss());
    const edge: Record<string, [number, number, number]> = {};
    for (const e of TOPOLOGY.edges) {
      let cb: { resp: number; succ: number } = state[e.target];
      if (down.has(e.target)) cb = { resp: 5, succ: 0 };
      edge[`${e.source}>${e.target}`] = edgeAttempt(e, cb);
    }
    const lam: Record<string, number> = Object.fromEntries(ORDER.map((s) => [s, 0]));
    lam.frontend = L0;
    for (const s of ORDER) {
      const r = lam[s];
      let priorOk = 1;
      for (const d of DOWNSTREAM[s]) {
        const [succ, , att] = edge[`${s}>${d}`];
        lam[d] += r * priorOk * att;
        priorOk *= succ;
      }
    }
    const next: Record<string, St> = {};
    for (const s of [...ORDER].reverse()) {
      const capEff = SERVICES[s].cap / mult[s];
      const rho = capEff ? lam[s] / capEff : 9;
      const own = (SERVICES[s].base * mult[s] * (1 + 0.03 * gauss())) / (1 - Math.min(rho, 0.95));
      const serve = down.has(s) ? 0 : rho > 1 ? Math.min(1, 1 / rho) : 1;
      let resp = own, priorOk = 1;
      for (const d of DOWNSTREAM[s]) {
        const [succ, ms] = edge[`${s}>${d}`];
        resp += priorOk * ms;
        priorOk *= succ;
      }
      next[s] = { resp, succ: serve * priorOk, own, rho, load: lam[s] };
    }
    state = next;
    if (t >= 0) out.push(state);
  }
  return out;
}

// ---------- intelligence (Section 7, simplified port) ----------
const CALLERS: Record<string, string[]> = Object.fromEntries(ORDER.map((s) => [s, [] as string[]]));
for (const s of ORDER) for (const d of DOWNSTREAM[s]) CALLERS[d].push(s);

function transitiveCallers(n: string): Set<string> {
  const seen = new Set<string>();
  const stack = [n];
  while (stack.length) {
    const x = stack.pop() as string;
    for (const c of CALLERS[x]) if (!seen.has(c)) { seen.add(c); stack.push(c); }
  }
  return seen;
}

function longestChain(root: string, anomalous: Set<string>, tFirst: Record<string, number>): string[] {
  let best: string[] = [root];
  const walk = (path: string[]) => {
    const cur = path[path.length - 1];
    let extended = false;
    for (const c of CALLERS[cur]) {
      if (anomalous.has(c) && tFirst[c] >= tFirst[cur] && !path.includes(c)) { extended = true; walk([...path, c]); }
    }
    if (!extended && path.length > best.length) best = path;
  };
  walk([root]);
  return best;
}

function analyse(tFirst: Record<string, number>, anomalous: string[], cur: Record<string, St>): Analysis | null {
  if (!anomalous.length) return null;
  const tmin = Math.min(...anomalous.map((n) => tFirst[n]));
  const tmax = Math.max(...anomalous.map((n) => tFirst[n]));
  const set = new Set(anomalous);
  const rows = anomalous.map((n) => {
    const earliness = 1 - (tFirst[n] - tmin) / (tmax - tmin + 1);
    const upstream = [...transitiveCallers(n)].filter((c) => set.has(c)).length;
    const impact = upstream / Math.max(1, anomalous.length - 1);
    const severity = Math.min(1, cur[n].own / SERVICES[n].base / 10);
    return { n, upstream, raw: 0.5 * earliness + 0.3 * impact + 0.2 * severity };
  });
  const sum = rows.reduce((a, r) => a + r.raw, 0) || 1;
  const root_cause = rows
    .map((r) => {
      const evidence: string[] = [tFirst[r.n] === tmin ? `latency rose first (tick ${tFirst[r.n]})` : `degraded at tick ${tFirst[r.n]}`];
      if (r.upstream > 0) evidence.push(`${r.upstream} upstream service${r.upstream > 1 ? "s" : ""} degraded after it`);
      return { node: r.n, confidence: Math.round((r.raw / sum) * 100) / 100, evidence };
    })
    .sort((a, b) => b.confidence - a.confidence);
  const top = root_cause[0].node;
  const direct = [...CALLERS[top]];
  const downstream = [...transitiveCallers(top)].filter((c) => !direct.includes(c));
  return {
    root_cause,
    propagation_path: longestChain(top, set, tFirst),
    blast_radius: { direct, downstream, total: direct.length + downstream.length, checkout_at_risk: direct.concat(downstream).includes("frontend") },
  };
}

function statusOf(resp: number, resp0: number, succ: number): NodeStatus {
  const ratio = resp / resp0;
  if (succ < 0.8 || ratio >= 3) return "critical";
  if (succ < 0.98 || ratio >= 1.5) return "degraded";
  return "healthy";
}

function metricsFrom(states: Record<string, St>, base: Record<string, St>): Record<string, NodeMetrics> {
  const nodes: Record<string, NodeMetrics> = {};
  for (const s of ORDER) {
    const x = states[s];
    nodes[s] = {
      status: statusOf(x.resp, base[s].resp, x.succ),
      p95_ms: Math.round(1.5 * x.resp),
      error_rate: Math.round((1 - x.succ) * 1000) / 1000,
      load_rps: Math.round(x.load * 10) / 10,
      utilization: Math.round(x.rho * 100) / 100,
    };
  }
  return nodes;
}

export function generateRun(scenario: ScenarioId, severity?: number, ticks = 40): TickMessage[] {
  const sev = severity ?? DEFAULT_SEVERITY[scenario];
  const raw = simulate(scenario, sev, ticks);
  const base = raw[0];
  const tFirst: Record<string, number> = {};
  const msgs: TickMessage[] = [];
  raw.forEach((states, t) => {
    const nodes = metricsFrom(states, base);
    const events: FlowEvent[] = [];
    for (const s of ORDER) {
      if (nodes[s].status !== "healthy" && tFirst[s] === undefined) {
        tFirst[s] = t;
        const failing = states[s].succ < 0.98;
        events.push({ t, node: s, kind: "anomaly_start", msg: `${SERVICE_LABEL[s]} ${failing ? "failing requests" : "latency rising"}` });
      }
    }
    const anomalous = ORDER.filter((s) => nodes[s].status !== "healthy");
    const fr = states.frontend;
    msgs.push({
      type: "tick", t, mode: "replay", scenario: t >= FAULT_AT ? scenario : null, severity: sev, nodes,
      checkout: { p95_ms: Math.min(3000, Math.round(1.5 * fr.resp)), error_rate: Math.round((1 - fr.succ) * 1000) / 1000 },
      events, analysis: analyse(tFirst, anomalous, states),
    });
  });
  return msgs;
}

export interface HealthySeed {
  nodes: Record<string, NodeMetrics>;
  history: Record<string, number[]>;
  checkout: { p95_ms: number; error_rate: number };
}
export function healthySeed(): HealthySeed {
  const raw = simulate(null, 1, 30);
  const base = raw[0];
  const history: Record<string, number[]> = Object.fromEntries(ORDER.map((s) => [s, [] as number[]]));
  raw.forEach((st) => ORDER.forEach((s) => history[s].push(Math.round(1.5 * st[s].resp))));
  const last = raw[raw.length - 1];
  return {
    nodes: metricsFrom(last, base), history,
    checkout: { p95_ms: Math.round(1.5 * last.frontend.resp), error_rate: Math.round((1 - last.frontend.succ) * 1000) / 1000 },
  };
}

export async function loadRun(scenario: ScenarioId, severity?: number): Promise<TickMessage[]> {
  try {
    const r = await fetch(`/fixtures/run.${scenario}.json`);
    if (r.ok) {
      const j = (await r.json()) as { ticks?: TickMessage[] };
      if (j.ticks && j.ticks.length) return j.ticks;
    }
  } catch {
    /* fall through to generated run */
  }
  return generateRun(scenario, severity);
}
