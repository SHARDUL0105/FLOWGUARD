// Mirrors Section 10 of the FLOWGUARD brief exactly. Do not rename fields.

export type NodeStatus = "healthy" | "degraded" | "critical";
export type ScenarioId = "db_latency" | "service_down" | "traffic_spike";
export type Mode = "live" | "replay";

export interface TopologyNode { id: string; label: string; layer: number; base_ms: number; capacity_rps: number; x?: number; y?: number; type?: string }
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
  resilience_score?: number;
  resilience_details?: Record<string, ResilienceDetail>;
}

export interface ResilienceDetail {
  utilization: number;
  success_rate: number;
  error_rate: number;
  p95_ms: number;
  base_p95_ms: number;
  error_penalty: number;
  latency_penalty: number;
  combined_penalty: number;
}

export interface WhatIfResponse {
  scenario: ScenarioId; factor: number;
  predicted: { p95_ms: number; error_rate: number; risk: "LOW" | "MEDIUM" | "HIGH"; saturated: string[] };
  measured: { p95_ms: number; error_rate: number };
  accuracy: number; note: string | null;
}

export interface PRListItem {
  id: number; title: string; author: string; status: string; project_id?: string;
  source?: "demo" | "user"; description?: string; diff?: string; created_at?: string;
}

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

  // Phase 6 & 10 Extended Attributes
  patch_hash?: string;
  revision_id?: string;
  changed_files?: string[];
  combined_status?: CombinedGateStatus;
  eligible_for_review?: boolean;
  automatic_merge_authorized?: boolean;
  review_signoff_required?: boolean;
  reviewer_approval_status?: string;
  security_revalidation?: {
    passed: boolean;
    policy_verdict: string;
    resolved_count: number;
    introduced_count: number;
    remaining_count: number;
    blocking_introduced_count: number;
    blocking_remaining_count: number;
    resolved_findings?: SecurityFinding[];
    introduced_findings?: SecurityFinding[];
    remaining_findings?: SecurityFinding[];
    summary: string;
  };
  original?: Record<string, any>;
  post_fix?: Record<string, any>;
}

// ─── Security & Combined PR Gate Types (Phases 8-11) ─────────────────────────

export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";
export type ScannerStatus = "completed" | "failed" | "skipped" | "unavailable";
export type CombinedGateStatus =
  | "ELIGIBLE_FOR_REVIEW"
  | "BLOCKED_SECURITY"
  | "BLOCKED_RELIABILITY"
  | "BLOCKED_BOTH"
  | "BLOCKED_CHECKS_INCOMPLETE";

export interface SecurityFinding {
  id: string;
  scanner: string;
  rule_id: string;
  category: "sast" | "secret" | "dependency" | "configuration" | "iac";
  severity: SecuritySeverity;
  title: string;
  explanation: string;
  file_path: string | null;
  line_number: number | null;
  remediation: string;
  confidence: string;
  package_name?: string | null;
  advisory_id?: string | null;
  is_new: boolean;
  raw_snippet?: string | null;
}

export interface ScannerMetadata {
  scanner: string;
  status: ScannerStatus;
  version?: string | null;
  duration_ms?: number;
  findings_count: number;
  error_message?: string | null;
}

export interface SecurityPolicyResult {
  verdict: "PASS" | "FAIL" | "INCOMPLETE";
  passed: boolean;
  blocking_findings_count: number;
  critical_count: number;
  high_count: number;
  exposed_secrets_count: number;
  summary: string;
  policy_version: string;
}

export interface SecurityScanReport {
  scan_id: string;
  pr_id: number | string;
  tenant_id: string;
  commit_or_patch_hash: string;
  timestamp: string;
  policy_version: string;
  scanners: ScannerMetadata[];
  findings: SecurityFinding[];
  policy: SecurityPolicyResult;
  is_clean: boolean;
  has_failures: boolean;
}

export interface CombinedVerificationResult {
  pr_id: number | string;
  tenant_id: string;
  timestamp: string;
  combined_status: CombinedGateStatus;
  eligible_for_review: boolean;
  automatic_merge_authorized: boolean;
  review_signoff_required: boolean;
  all_checks_completed: boolean;
  reliability: {
    status: "PASS" | "FAIL" | "INCOMPLETE";
    score: number;
    score_base: number;
    verdict: string;
    findings_count: number;
  };
  security: {
    status: "PASS" | "FAIL" | "INCOMPLETE";
    blocking_findings_count: number;
    critical_count: number;
    high_count: number;
    secrets_count: number;
    policy_verdict: string;
  };
  machine_readable_reasons: string[];
  decision_summary: string;
}
