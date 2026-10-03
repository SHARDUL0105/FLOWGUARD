// Mirrors Brief Section 10 exactly. Do not rename fields.
export type NodeStatus = "healthy" | "degraded" | "critical";
export interface NodeMetrics { status: NodeStatus; p95_ms: number; error_rate: number; load_rps: number; utilization: number; }
export interface TopoNode { id: string; label: string; layer: number; base_ms: number; capacity_rps: number; }
export interface TopoEdge { source: string; target: string; timeout_ms: number | null; retries: number; breaker: boolean; fallback: boolean; }
export interface Topology { nodes: TopoNode[]; edges: TopoEdge[]; }
export interface RootCauseCandidate { node: string; confidence: number; evidence: string[]; }
export interface BlastRadius { direct: string[]; downstream: string[]; total: number; checkout_at_risk: boolean; }
export interface Analysis { root_cause: RootCauseCandidate[]; propagation_path: string[]; blast_radius: BlastRadius; }
export interface EventItem { t: number; node: string; kind: "anomaly_start" | "recovered"; msg: string; }
export interface TickMessage {
  type: "tick"; t: number; mode: "live" | "replay"; scenario: string | null; severity: number;
  nodes: Record<string, NodeMetrics>; checkout: { p95_ms: number; error_rate: number };
  events: EventItem[]; analysis: Analysis | null;
}
export interface WhatIfResponse {
  scenario: string; factor: number;
  predicted: { p95_ms: number; error_rate: number; risk: "LOW" | "MEDIUM" | "HIGH"; saturated: string[] };
  measured: { p95_ms: number; error_rate: number }; accuracy: number; note: string | null;
}
export interface PRListItem { id: number; title: string; author: string; status: string; }
export interface Finding { rule: string; severity: "high" | "medium" | "low"; edge: string; message: string; evidence: string; }
export interface AnalyzeResponse {
  id: number; score_base: number; score_pr: number; verdict: string;
  per_scenario: { scenario: string; base: { p95_ms: number; error_rate: number }; pr: { p95_ms: number; error_rate: number } }[];
  findings: Finding[]; cascade_path: string[]; diff: string; comment: string;
}
export interface HealResponse {
  id: number; gate: "accepted" | "rejected"; reason: string | null; score_before: number; score_after: number;
  patch_diff: string; per_scenario_after: { scenario: string; p95_ms: number; error_rate: number }[]; verified_under: string[];
}
