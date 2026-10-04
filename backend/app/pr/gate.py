"""Owner: Vaishnavi. Acceptance gate for Auto-Fix verification.
Re-runs simulator scenarios against both the PR configuration and the patched configuration.
Accepts ONLY if:
A. score_after >= score_pr + 15
B. error_rate_after <= error_rate_pr for every verified scenario
C. healthy_p95_after <= 1.10 * baseline_healthy_p95
Verified under all 3 standard scenarios: db_latency, service_down, traffic_spike.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional, Tuple, Union

from ..intel.scoring import resilience_score
from ..sim.reference_sim import BASE_EDGES, SCENARIOS, SEVERITY, run, window

VERIFIED_SCENARIOS: List[str] = list(SCENARIOS)
SCORE_IMPROVEMENT_MIN: int = 15
HEALTHY_LATENCY_MAX_FACTOR: float = 1.10


def evaluate_acceptance(
    score_pr: int,
    score_after: int,
    per_scenario_pr: Dict[str, Dict[str, float]],
    per_scenario_after: Dict[str, Dict[str, float]],
    healthy_p95_after: float,
    healthy_p95_base: float,
) -> Tuple[str, Optional[str]]:
    """Evaluate the 3 acceptance gate rules.

    Returns:
        Tuple of ("accepted" | "rejected", reason_str or None)
    """
    # Rule A: Score improvement >= 15
    if score_after < score_pr + SCORE_IMPROVEMENT_MIN:
        return (
            "rejected",
            f"Score improvement insufficient: {score_after} < {score_pr} + {SCORE_IMPROVEMENT_MIN}",
        )

    # Rule B: No scenario error rate regression
    for sc in VERIFIED_SCENARIOS:
        err_pr = per_scenario_pr.get(sc, {}).get("error_rate", 0.0)
        err_after = per_scenario_after.get(sc, {}).get("error_rate", 0.0)
        # Allow tiny floating-point margin
        if err_after > err_pr + 1e-4:
            return (
                "rejected",
                f"Error rate regressed on scenario '{sc}': {err_after:.3f} > {err_pr:.3f}",
            )

    # Rule C: Healthy p95 after fix <= 1.10x baseline
    max_healthy_p95 = HEALTHY_LATENCY_MAX_FACTOR * healthy_p95_base
    if healthy_p95_after > max_healthy_p95:
        return (
            "rejected",
            f"Healthy latency regressed: {healthy_p95_after:.1f}ms exceeds 1.10x baseline ({max_healthy_p95:.1f}ms)",
        )

    return ("accepted", None)


def verify_fix(
    pr_edges: Dict[Tuple[str, str], Dict[str, Any]],
    patched_edges: Dict[Tuple[str, str], Dict[str, Any]],
    patch_diff: str = "",
    pr_id: Optional[Union[int, str]] = None,
) -> Dict[str, Any]:
    """Execute the full gate verification flow:
    1. Run healthy baseline on BASE_EDGES.
    2. Run 3 scenarios on PR configuration.
    3. Run 3 scenarios on patched configuration + healthy smoke run.
    4. Calculate resilience scores before and after.
    5. Verify all rules pass.
    6. Return complete gate result matching HealResponse contract.
    """
    # 1. Baseline healthy run
    base_out = run(BASE_EDGES, fault=None, ticks=60, seed=7)
    base_p95, _ = window(base_out)

    # 2. Scenarios on original PR configuration
    per_scenario_pr: Dict[str, Dict[str, float]] = {}
    for sc in VERIFIED_SCENARIOS:
        sev = SEVERITY.get(sc, 3.0)
        pr_out = run(pr_edges, fault=sc, severity=sev, ticks=60, seed=7)
        p95, err = window(pr_out)
        per_scenario_pr[sc] = {"p95_ms": round(p95), "error_rate": round(err, 3)}

    # 3. Scenarios on patched configuration
    per_scenario_after_dict: Dict[str, Dict[str, float]] = {}
    per_scenario_after_list: List[Dict[str, Any]] = []
    for sc in VERIFIED_SCENARIOS:
        sev = SEVERITY.get(sc, 3.0)
        patched_out = run(patched_edges, fault=sc, severity=sev, ticks=60, seed=7)
        p95, err = window(patched_out)
        metrics = {"p95_ms": round(p95), "error_rate": round(err, 3)}
        per_scenario_after_dict[sc] = metrics
        per_scenario_after_list.append({"scenario": sc, **metrics})

    # Patched healthy smoke run
    patched_healthy_out = run(patched_edges, fault=None, ticks=60, seed=7)
    healthy_p95_after, _ = window(patched_healthy_out)

    # 4. Resilience scores
    score_before = resilience_score(pr_edges)
    score_after = resilience_score(patched_edges)

    # 5. Evaluate acceptance rules
    status, reason = evaluate_acceptance(
        score_pr=score_before,
        score_after=score_after,
        per_scenario_pr=per_scenario_pr,
        per_scenario_after=per_scenario_after_dict,
        healthy_p95_after=healthy_p95_after,
        healthy_p95_base=base_p95,
    )

    result: Dict[str, Any] = {
        "gate": status,
        "reason": reason,
        "score_before": score_before,
        "score_after": score_after,
        "patch_diff": patch_diff,
        "per_scenario_after": per_scenario_after_list,
        "verified_under": list(VERIFIED_SCENARIOS),
    }
    if pr_id is not None:
        try:
            result["id"] = int(pr_id)
        except (ValueError, TypeError):
            result["id"] = pr_id

    return result


def gate(
    pr_edges_or_score_pr: Any = None,
    patched_edges_or_score_after: Any = None,
    patch_diff_or_per_pr: Any = "",
    pr_id_or_per_after: Any = None,
    healthy_ratio_or_base: Any = None,
    *,
    pr_edges: Any = None,
    patched_edges: Any = None,
    patch_diff: str = "",
    pr_id: Any = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Unified gate entry point supporting both full re-run verification
    and direct metric evaluation.
    """
    actual_pr_edges = pr_edges if pr_edges is not None else pr_edges_or_score_pr
    actual_patched_edges = patched_edges if patched_edges is not None else patched_edges_or_score_after

    # Case A: Called with numerical scores and precalculated dicts
    if isinstance(actual_pr_edges, (int, float)) and isinstance(
        actual_patched_edges, (int, float)
    ):
        score_pr = int(actual_pr_edges)
        score_after = int(actual_patched_edges)
        per_pr = patch_diff_or_per_pr if isinstance(patch_diff_or_per_pr, dict) else kwargs.get("per_scenario_pr", {})
        per_after = pr_id_or_per_after if isinstance(pr_id_or_per_after, dict) else kwargs.get("per_scenario_after", {})
        ratio = float(healthy_ratio_or_base) if healthy_ratio_or_base is not None else kwargs.get("healthy_ratio", 1.0)

        status, reason = evaluate_acceptance(
            score_pr=score_pr,
            score_after=score_after,
            per_scenario_pr=per_pr,
            per_scenario_after=per_after,
            healthy_p95_after=ratio,
            healthy_p95_base=1.0,
        )
        return {
            "gate": status,
            "reason": reason,
            "score_before": score_pr,
            "score_after": score_after,
            "verified_under": list(VERIFIED_SCENARIOS),
        }

    # Case B: Called with edge configs (pr_edges, patched_edges, patch_diff, pr_id)
    actual_diff = patch_diff or (patch_diff_or_per_pr if isinstance(patch_diff_or_per_pr, str) else "")
    actual_pr_id = pr_id if pr_id is not None else (pr_id_or_per_after if not isinstance(pr_id_or_per_after, dict) else kwargs.get("pr_id"))
    return verify_fix(pr_edges=actual_pr_edges, patched_edges=actual_patched_edges, patch_diff=actual_diff, pr_id=actual_pr_id)
