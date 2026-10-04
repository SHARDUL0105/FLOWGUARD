from __future__ import annotations
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

NodeStatus = Literal["healthy", "degraded", "critical"]
ScenarioId = Literal["db_latency", "service_down", "traffic_spike"]
Mode = Literal["live", "replay"]

class TopologyNode(BaseModel):
    id: str; label: str; layer: int; base_ms: float; capacity_rps: float
class TopologyEdge(BaseModel):
    source: str; target: str; timeout_ms: Optional[float]; retries: int; breaker: bool; fallback: bool
class Topology(BaseModel):
    nodes: List[TopologyNode]; edges: List[TopologyEdge]
class NodeMetrics(BaseModel):
    status: NodeStatus; p95_ms: float; error_rate: float; load_rps: float; utilization: float
class CheckoutMetrics(BaseModel):
    p95_ms: float; error_rate: float
class FlowEvent(BaseModel):
    t: int; node: str; kind: Literal["anomaly_start","recovered"]; msg: str
class RootCauseCandidate(BaseModel):
    node: str; confidence: float; evidence: List[str]
class BlastRadius(BaseModel):
    direct: List[str]; downstream: List[str]; total: int; checkout_at_risk: bool
class Analysis(BaseModel):
    root_cause: List[RootCauseCandidate]; propagation_path: List[str]; blast_radius: BlastRadius
class TickMessage(BaseModel):
    type: Literal["tick"]="tick"; t: int; mode: Mode; scenario: Optional[ScenarioId]; severity: float
    nodes: Dict[str, NodeMetrics]; checkout: CheckoutMetrics; events: List[FlowEvent]; analysis: Optional[Analysis]
class ChaosRequest(BaseModel):
    scenario: ScenarioId; severity: Optional[float]=None
class DemoModeRequest(BaseModel):
    mode: Mode
class WhatIfRequest(BaseModel):
    scenario: ScenarioId; factor: float=Field(ge=0.1, le=10)
class Predicted(BaseModel):
    p95_ms: float; error_rate: float; risk: Literal["LOW","MEDIUM","HIGH"]; saturated: List[str]
class Measured(BaseModel):
    p95_ms: float; error_rate: float
class WhatIfResponse(BaseModel):
    scenario: ScenarioId; factor: float; predicted: Predicted; measured: Measured; accuracy: float; note: Optional[str]
class PRListItem(BaseModel):
    id: int; title: str; author: str; status: str
class ScenarioNumbers(BaseModel):
    p95_ms: float; error_rate: float
class Finding(BaseModel):
    rule: str; severity: Literal["high","medium","low"]; edge: str; message: str; evidence: str
class AnalyzeResponse(BaseModel):
    id: int; score_base: int; score_pr: int; verdict: str; per_scenario: list[dict]; findings: List[Finding]; cascade_path: List[str]; diff: str; comment: str
class HealResponse(BaseModel):
    id: int; gate: Literal["accepted","rejected"]; reason: Optional[str]; score_before: int; score_after: int; patch_diff: str; per_scenario_after: list[dict]; verified_under: List[ScenarioId]
