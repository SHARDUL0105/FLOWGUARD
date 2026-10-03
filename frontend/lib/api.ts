// Owner: Shardul. Typed REST wrappers. Falls back to mock.ts when backend is unreachable.
import type { Topology, WhatIfResponse, AnalyzeResponse, HealResponse } from "./types";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}
export const api = {
  topology: () => req<Topology>("/api/topology"),
  chaos: (scenario: string, severity?: number) => req("/api/chaos", { method: "POST", body: JSON.stringify({ scenario, severity }) }),
  reset: () => req("/api/reset", { method: "POST" }),
  whatif: (scenario: string, factor: number) => req<WhatIfResponse>("/api/whatif", { method: "POST", body: JSON.stringify({ scenario, factor }) }),
  analyzePR: (id: number) => req<AnalyzeResponse>(`/api/pr/${id}/analyze`, { method: "POST" }),
  healPR: (id: number) => req<HealResponse>(`/api/pr/${id}/heal`, { method: "POST" }),
};
