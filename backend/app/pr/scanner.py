"""Owner: Vaishnavi. Static rule scanner for pull request resilience checks.
Inspects ONLY the edge configuration changes introduced by a PR and produces deterministic findings.
Rules implemented:
- R1_TIMEOUT (high): timeout is null/removed OR exceeds upstream caller timeout
- R2_RETRY_STORM (high): retries >= 3 without backoff
- R3_NO_FALLBACK (medium): breaker is false and fallback is false on a non-database dependency
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Union

from ..sim.reference_sim import BASE_EDGES
from .prs import pr_edges as get_pr_edges

RULE_TIMEOUT = "R1_TIMEOUT"
RULE_RETRY_STORM = "R2_RETRY_STORM"
RULE_NO_FALLBACK = "R3_NO_FALLBACK"


def _get_upstream_callers(node: str, edges: Dict[Tuple[str, str], Dict[str, Any]]) -> List[str]:
    """Find all direct callers that make outgoing calls to `node`."""
    return [src for (src, dst) in edges.keys() if dst == node]


def _get_edge_param(cfg: Dict[str, Any], key: str, fallback_key: Optional[str] = None, default: Any = None) -> Any:
    if key in cfg:
        return cfg[key]
    if fallback_key and fallback_key in cfg:
        return cfg[fallback_key]
    return default


def _is_edge_changed(base_cfg: Dict[str, Any], pr_cfg: Dict[str, Any]) -> bool:
    """Compare resilience parameters between base edge and PR edge."""
    base_t = _get_edge_param(base_cfg, "timeout", "timeout_ms")
    pr_t = _get_edge_param(pr_cfg, "timeout", "timeout_ms")
    if base_t != pr_t:
        return True

    base_r = _get_edge_param(base_cfg, "retries", default=0)
    pr_r = _get_edge_param(pr_cfg, "retries", default=0)
    if base_r != pr_r:
        return True

    base_b = bool(_get_edge_param(base_cfg, "breaker", "circuit_breaker", False))
    pr_b = bool(_get_edge_param(pr_cfg, "breaker", "circuit_breaker", False))
    if base_b != pr_b:
        return True

    base_f = bool(_get_edge_param(base_cfg, "fallback", default=False))
    pr_f = bool(_get_edge_param(pr_cfg, "fallback", default=False))
    if base_f != pr_f:
        return True

    return False


def scan(
    base_edges: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    pr_edges: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    *,
    pr_id: Optional[Union[int, str]] = None,
) -> List[Dict[str, Any]]:
    """Scan changed edges in a PR and return structured findings.

    Args:
        base_edges: Baseline edge config (defaults to BASE_EDGES).
        pr_edges: PR edge config (if None and pr_id is provided, loaded via pr_edges(pr_id)).
        pr_id: Optional demo PR id (e.g. 12 or 13).

    Returns:
        List of structured findings matching the AnalyzeResponse schema:
        [{"rule": ..., "severity": ..., "edge": ..., "message": ..., "evidence": ...}]
    """
    if base_edges is None:
        base_edges = BASE_EDGES

    if pr_edges is None:
        if pr_id is not None:
            pr_edges = get_pr_edges(pr_id)
        else:
            pr_edges = base_edges

    findings: List[Dict[str, Any]] = []

    # Identify all edges in either configuration
    all_edge_keys = set(base_edges.keys()).union(set(pr_edges.keys()))

    for edge_key in all_edge_keys:
        u, v = edge_key
        base_cfg = base_edges.get(edge_key)
        pr_cfg = pr_edges.get(edge_key)

        # Only scan edges CHANGED by the PR
        if base_cfg is not None and pr_cfg is not None:
            if not _is_edge_changed(base_cfg, pr_cfg):
                continue
        elif base_cfg is None and pr_cfg is None:
            continue

        active_cfg = pr_cfg if pr_cfg is not None else {}
        edge_str = f"{u}->{v}"

        # Resolve upstream callers for context and upstream timeout checks
        upstream_callers = _get_upstream_callers(u, pr_edges)
        upstream_name = upstream_callers[0] if upstream_callers else "gateway"

        # Determine upstream timeout threshold
        upstream_timeout: Optional[int] = None
        for up in upstream_callers:
            up_cfg = pr_edges.get((up, u)) or base_edges.get((up, u), {})
            t_val = _get_edge_param(up_cfg, "timeout", "timeout_ms")
            if t_val is not None:
                upstream_timeout = t_val if upstream_timeout is None else min(upstream_timeout, t_val)

        # ----------------------------------------------------
        # Rule 1: R1_TIMEOUT (severity: high)
        # Trigger when timeout is null/removed OR exceeds upstream caller timeout
        # ----------------------------------------------------
        pr_timeout = _get_edge_param(active_cfg, "timeout", "timeout_ms")
        if pr_timeout is None:
            findings.append({
                "rule": RULE_TIMEOUT,
                "severity": "high",
                "edge": edge_str,
                "message": f"No effective timeout on {u} -> {v}; callers can hang until the {upstream_name} gives up.",
                "evidence": "timeout_ms: null",
            })
        elif upstream_timeout is not None and pr_timeout > upstream_timeout:
            findings.append({
                "rule": RULE_TIMEOUT,
                "severity": "high",
                "edge": edge_str,
                "message": f"Timeout on {u} -> {v} ({pr_timeout}ms) exceeds upstream {upstream_name} timeout ({upstream_timeout}ms); callers can hang.",
                "evidence": f"timeout_ms: {pr_timeout} > {upstream_timeout}",
            })

        # ----------------------------------------------------
        # Rule 2: R2_RETRY_STORM (severity: high)
        # Trigger when retries >= 3
        # ----------------------------------------------------
        pr_retries = _get_edge_param(active_cfg, "retries", default=0)
        if pr_retries >= 3:
            findings.append({
                "rule": RULE_RETRY_STORM,
                "severity": "high",
                "edge": edge_str,
                "message": f"{pr_retries} retries without backoff multiplies load on a struggling dependency.",
                "evidence": f"retries: {pr_retries}",
            })

        # ----------------------------------------------------
        # Rule 3: R3_NO_FALLBACK (severity: medium)
        # Trigger when breaker == False and fallback == False on non-database edge
        # ----------------------------------------------------
        pr_breaker = bool(_get_edge_param(active_cfg, "breaker", "circuit_breaker", False))
        pr_fallback = bool(_get_edge_param(active_cfg, "fallback", default=False))

        if not pr_breaker and not pr_fallback and v != "database":
            findings.append({
                "rule": RULE_NO_FALLBACK,
                "severity": "medium",
                "edge": edge_str,
                "message": f"No circuit breaker or fallback on {u} -> {v}.",
                "evidence": "breaker: false, fallback: false",
            })

    return findings


def scan_pr(pr_id: Union[int, str]) -> List[Dict[str, Any]]:
    """Helper to scan a specific demo PR by ID against BASE_EDGES."""
    return scan(base_edges=BASE_EDGES, pr_edges=get_pr_edges(pr_id))
