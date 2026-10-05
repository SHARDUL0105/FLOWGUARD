// Typed REST wrappers. Every call falls back to recorded fixtures (public/fixtures) when the backend is unreachable.
import type { AnalyzeResponse, HealResponse, Mode, PRListItem, ScenarioId, WhatIfResponse } from "./types";
import { WHATIF } from "./fixtures";
import { getTenant } from "./tenant";

export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function withTimeout(input: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(input, { ...init, signal: ctl.signal }); } finally { clearTimeout(id); }
}
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await withTimeout(BASE + path, { headers: { "Content-Type": "application/json", "X-Tenant-ID": getTenant(), ...(init?.headers ?? {}) }, ...init });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}
async function fixture<T>(name: string): Promise<T> {
  const r = await fetch(`/fixtures/${name}`);
  if (!r.ok) throw new Error(`fixture ${name} missing`);
  return r.json();
}
export type Source = "live" | "fixture";

export const api = {
  health: () => req<{ ok: boolean; mode: Mode }>("/api/health"),
  chaos: (scenario: ScenarioId, severity?: number) => req("/api/chaos", { method: "POST", body: JSON.stringify({ scenario, severity }) }),
  reset: () => req("/api/reset", { method: "POST" }),
  setMode: (mode: Mode) => req("/api/demo/mode", { method: "POST", body: JSON.stringify({ mode }) }),

  async prList(projectId?: string): Promise<PRListItem[]> {
    const qs = projectId ? `?project_id=${projectId}` : "";
    try { return await req<PRListItem[]>(`/api/pr${qs}`); } catch { return fixture<PRListItem[]>("pr.list.json"); }
  },
  async createPR(data: { title: string; author: string; project_id: string; description?: string; diff?: string }): Promise<PRListItem & { pr_id: number }> {
    return req("/api/pr", { method: "POST", body: JSON.stringify(data) });
  },
  async deletePR(prId: number): Promise<{ ok: boolean }> {
    return req(`/api/pr/${prId}`, { method: "DELETE" });
  },
  async whatif(scenario: ScenarioId, factor: number): Promise<{ data: WhatIfResponse; source: Source }> {
    try { return { data: await req<WhatIfResponse>("/api/whatif", { method: "POST", body: JSON.stringify({ scenario, factor }) }), source: "live" }; }
    catch {
      const rows = (WHATIF as Record<string, WhatIfResponse[]>)[scenario] ?? WHATIF.db_latency;
      const near = rows.reduce((a, b) => (Math.abs(b.factor - factor) < Math.abs(a.factor - factor) ? b : a));
      return { data: near, source: "fixture" };
    }
  },
  async analyzePR(id: number): Promise<{ data: AnalyzeResponse; source: Source }> {
    try { return { data: await req<AnalyzeResponse>(`/api/pr/${id}/analyze`, { method: "POST" }), source: "live" }; }
    catch { return { data: await fixture<AnalyzeResponse>(id === 13 ? "pr.safe.analyze.json" : "pr.risky.analyze.json"), source: "fixture" }; }
  },
  async healPR(id: number): Promise<{ data: HealResponse; source: Source }> {
    try { return { data: await req<HealResponse>(`/api/pr/${id}/heal`, { method: "POST" }), source: "live" }; }
    catch { return { data: await fixture<HealResponse>("pr.risky.heal.json"), source: "fixture" }; }
  },
  async tenants(): Promise<{ tenant_id: string; name: string; plan: string }[]> {
    try { return await req("/api/tenants"); } catch { return []; }
  },
  async dbStatus(): Promise<{ configured: boolean; connected: boolean }> {
    try { return await req("/api/db/status"); } catch { return { configured: false, connected: false }; }
  },
  /** Stored results from MongoDB Atlas. Returns [] when no database is configured or the backend is off. */
  async history(kind: "pr_checks" | "heal_results" | "incidents", limit = 6): Promise<Record<string, unknown>[]> {
    try { return await req<Record<string, unknown>[]>(`/api/history?kind=${kind}&limit=${limit}`); } catch { return []; }
  },
  /** Reads the SSE brief to the end. Returns null if the backend is unreachable (caller uses its template). */
  async brief(q: { scenario?: string; pr?: number }): Promise<{ text: string; source: string } | null> {
    try {
      const qs = q.pr !== undefined ? `pr=${q.pr}` : `scenario=${q.scenario ?? "db_latency"}`;
      const r = await withTimeout(`${BASE}/api/brief?${qs}`, { headers: { "X-Tenant-ID": getTenant() } }, 9000);
      if (!r.ok) return null;
      let text = "", source = "template";
      for (const line of (await r.text()).split("\n")) {
        if (!line.startsWith("data:")) continue;
        try { const j = JSON.parse(line.slice(5)); if (j.chunk) text += j.chunk; if (j.done) source = j.source ?? source; } catch { /* skip */ }
      }
      return text.trim() ? { text, source } : null;
    } catch { return null; }
  },

  /** Project CRUD endpoints backed by MongoDB Atlas */
  async listProjects(): Promise<Record<string, any>[]> {
    try { return await req("/api/projects"); } catch { return []; }
  },
  async getProject(id: string): Promise<Record<string, any> | null> {
    try { return await req(`/api/projects/${id}`); } catch { return null; }
  },
  async createProject(data: Record<string, any>): Promise<Record<string, any>> {
    return await req("/api/projects", { method: "POST", body: JSON.stringify(data) });
  },
  async updateProject(id: string, updates: Record<string, any>): Promise<Record<string, any>> {
    return await req(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
  },
  async deleteProject(id: string): Promise<{ ok: boolean }> {
    return await req(`/api/projects/${id}`, { method: "DELETE" });
  },
  async getTopology(projectId: string): Promise<Record<string, any> | null> {
    try { return await req(`/api/projects/${projectId}/topology`); } catch { return null; }
  },
  async saveTopology(projectId: string, topology: { nodes: any[]; edges: any[] }): Promise<{ ok: boolean }> {
    return await req(`/api/projects/${projectId}/topology`, { method: "PUT", body: JSON.stringify(topology) });
  },
  async simulateProject(projectId: string): Promise<Record<string, any>> {
    return await req(`/api/projects/${projectId}/simulate`, { method: "POST" });
  },
};
