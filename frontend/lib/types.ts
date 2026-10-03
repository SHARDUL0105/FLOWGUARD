// Mirrors Section 10 of the FLOWGUARD brief exactly. Do not rename fields.

export type NodeStatus = "healthy" | "degraded" | "critical";
export type ScenarioId = "db_latency" | "service_down" | "traffic_spike";
export type Mode = "live" | "replay";

export interface TopologyNode { id: string; label: string; layer: number; base_ms: number; capacity_rps: number }
export interface TopologyEdge {
  source: string; target: string; timeout_ms: number | null; retries: number; breaker: boolean; fallback: boolean;
}
export interface Topology { nodes: TopologyNode[]; edges: TopologyEdge[] }

export interface NodeMetrics { status: NodeStatus; p95_ms: number; error_rate: number; load_rps: number; utilization: number }
export interface CheckoutMetrics { p95_ms: number; error_rate: number }
export interface FlowEvent { t: number; node: string; kind: "anomaly_start" | "recovered"; msg: string }

export interface RootCauseCandidate { node: string; confidence: number; evidence: string[] }
export interface BlastRadius { direct: string[]; downstream: string[]; total: number; checkout_at_risk: boolean }
export interface Analysis { root_cause: RootCauseCandidate[]; propagation_path: string[]; blast_radius: BlastRadius }

export interface TickMessage {
  type: "tick"; t: number; mode: Mode; scenario: ScenarioId | null; severity: number;
  nodes: Record<string, NodeMetrics>; checkout: CheckoutMetrics; events: FlowEvent[]; analysis: Analysis | null;
}

export interface WhatIfResponse {
  scenario: ScenarioId; factor: number;
  predicted: { p95_ms: number; error_rate: number; risk: "LOW" | "MEDIUM" | "HIGH"; saturated: string[] };
  measured: { p95_ms: number; error_rate: number };
  accuracy: number; note: string | null;
}

export interface PRListItem { id: number; title: string; author: string; status: string }

export interface ScenarioNumbers { p95_ms: number; error_rate: number }
export interface AnalyzeResponse {
  id: number; score_base: number; score_pr: number; verdict: string;
  per_scenario: { scenario: ScenarioId; base: ScenarioNumbers; pr: ScenarioNumbers }[];
  findings: { rule: string; severity: "high" | "medium" | "low"; edge: string; message: string; evidence: string }[];
  cascade_path: string[]; diff: string; comment: string;
}
export interface HealResponse {
  id: number; gate: "accepted" | "rejected"; reason: string | null; score_before: number; score_after: number;
  patch_diff: string; per_scenario_after: ({ scenario: ScenarioId } & ScenarioNumbers)[]; verified_under: ScenarioId[];
}
