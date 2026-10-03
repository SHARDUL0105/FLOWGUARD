"""Owner: Abhiraj. Pydantic models mirroring Section 10. Fill in as endpoints are built."""
from typing import Literal, Optional
from pydantic import BaseModel

Status = Literal["healthy", "degraded", "critical"]

class NodeMetrics(BaseModel):
    status: Status
    p95_ms: float
    error_rate: float
    load_rps: float
    utilization: float

class ChaosRequest(BaseModel):
    scenario: Literal["db_latency", "service_down", "traffic_spike"]
    severity: Optional[float] = None

class WhatIfRequest(BaseModel):
    scenario: Literal["db_latency", "service_down", "traffic_spike"]
    factor: float

class DemoModeRequest(BaseModel):
    mode: Literal["live", "replay"]
