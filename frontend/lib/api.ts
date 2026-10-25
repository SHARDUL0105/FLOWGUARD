// Typed REST wrappers. Every call falls back to recorded fixtures (public/fixtures) when the backend is unreachable.
import type { AnalyzeResponse, CombinedVerificationResult, HealResponse, Mode, PRListItem, ScenarioId, SecurityScanReport, WhatIfResponse } from "./types";
import { WHATIF } from "./fixtures";
import { getTenant, getAuthToken } from "./tenant";

export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function withTimeout(input: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(input, { ...init, signal: ctl.signal }); } finally { clearTimeout(id); }
}
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? getAuthToken() : null;
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-ID": getTenant(),
  };
  if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
  if (init?.headers) {
    Object.assign(reqHeaders, init.headers);
  }
  const r = await withTimeout(BASE + path, {
    ...init,
    headers: reqHeaders,
  });
  if (!r.ok) {
    let errDetail = "";
    try {
      const j = await r.json();
      errDetail = j.detail || "";
    } catch {}
    throw new Error(errDetail || `${path} -> ${r.status}`);
  }
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
  async analyzeSecurityPR(id: number): Promise<{ data: SecurityScanReport; source: Source }> {
    try { return { data: await req<SecurityScanReport>(`/api/pr/${id}/security/analyze`, { method: "POST" }), source: "live" }; }
    catch {
      const fixName = id === 13 ? "pr.13.security.json" : "pr.12.security.json";
      return { data: await fixture<SecurityScanReport>(fixName), source: "fixture" };
    }
  },
  async combinedVerification(id: number): Promise<{ data: CombinedVerificationResult; source: Source }> {
    try { return { data: await req<CombinedVerificationResult>(`/api/pr/${id}/combined`), source: "live" }; }
    catch {
      const fixName = id === 13 ? "pr.13.combined.json" : "pr.12.combined.json";
      return { data: await fixture<CombinedVerificationResult>(fixName), source: "fixture" };
    }
  },
  async demoCases(): Promise<Record<string, any>> {
    try { return await req<Record<string, any>>("/api/pr-demo-cases"); }
    catch {
      try {
        const c1 = await fixture<any>("security/case1_rel_pass_sec_pass.json");
        const c2 = await fixture<any>("security/case2_rel_pass_sec_fail.json");
        const c3 = await fixture<any>("security/case3_rel_fail_sec_pass.json");
        const c4 = await fixture<any>("security/case4_rel_fail_sec_fail.json");
        const c5 = await fixture<any>("security/case5_checks_incomplete.json");
        return {
          case_1_rel_pass_sec_pass: c1,
          case_2_rel_pass_sec_fail: c2,
          case_3_rel_fail_sec_pass: c3,
          case_4_rel_fail_sec_fail: c4,
          case_5_checks_incomplete: c5,
        };
      } catch {
        return {};
      }
    }
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
  async listProjects(overrideTenant?: string): Promise<Record<string, any>[]> {
    try {
      const headers = overrideTenant ? { "X-Tenant-ID": overrideTenant } : undefined;
      return await req("/api/projects", { headers });
    } catch { return []; }
  },
  async getProject(id: string, overrideTenant?: string): Promise<Record<string, any> | null> {
    try {
      const headers = overrideTenant ? { "X-Tenant-ID": overrideTenant } : undefined;
      return await req(`/api/projects/${id}`, { headers });
    } catch { return null; }
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

  /** Authentication & Security APIs */
  async login(credentials: { username_or_email: string; password: string; tenant_id?: string }): Promise<{ ok: boolean; token: string; user: any; message: string }> {
    return await req("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  },
  async register(data: { username: string; email: string; password: string; tenant_id: string; role?: string; name?: string; title?: string }): Promise<{ ok: boolean; token: string; user: any; message: string }> {
    return await req("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
  },
  async superAdmins(): Promise<{ team: string; super_admins: any[] }> {
    return await req("/api/auth/super-admins");
  },
  async getTenantUsers(): Promise<any[]> {
    return await req("/api/auth/users");
  },

  /** Temporary Super-Admin Access Grant */
  async grantAdminAccess(durationMinutes: number): Promise<{ ok: boolean; expires_at: number; message: string }> {
    return await req("/api/auth/grant-admin-access", { method: "POST", body: JSON.stringify({ duration_minutes: durationMinutes }) });
  },
  async revokeAdminAccess(): Promise<{ ok: boolean; message: string }> {
    return await req("/api/auth/revoke-admin-access", { method: "DELETE" });
  },
  async checkAdminGrant(tenantId: string): Promise<{ granted: boolean; expires_at?: number; remaining_seconds?: number }> {
    try { return await req(`/api/auth/check-admin-grant/${tenantId}`); } catch { return { granted: false }; }
  },
  async listActiveGrants(): Promise<{ grants: Record<string, { expires_at: number; remaining_seconds: number }> }> {
    try { return await req("/api/auth/active-grants"); } catch { return { grants: {} }; }
  },
};