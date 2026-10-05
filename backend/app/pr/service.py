"""PR analyze / heal as pure functions (used by api.py and scripts/record_fixtures.py)."""
from __future__ import annotations

from ..sim.topology import BASE_EDGES
from ..sim.config import DEFAULT_SEVERITY, SCENARIOS
from ..sim.engine import run, window
from ..intel.runtime.scoring import resilience_score
from ..ai.pr_comment import render_comment
from .prs import get_pr, pr_edges as get_pr_edges, pr_diff
from .scanner import scan
from .heal import heal as heal_pr_edges
from .gate import gate as run_gate


def analyze_pr(pr_id: int):
    """Returns the AnalyzeResponse dict (Section 10) or None if the PR does not exist."""
    pr = get_pr(pr_id)
    if not pr:
        return None
    current = get_pr_edges(pr_id)
    score_base, _, _ = resilience_score(BASE_EDGES)
    score_pr, _, _ = resilience_score(current)
    findings = scan(base_edges=BASE_EDGES, pr_edges=current)
    per = []
    for sc in SCENARIOS:
        sev = DEFAULT_SEVERITY[sc]
        bp, be = window(run(BASE_EDGES, sc, severity=sev))
        pp, pe = window(run(current, sc, severity=sev))
        per.append({"scenario": sc,
                    "base": {"p95_ms": round(bp), "error_rate": round(be, 3)},
                    "pr": {"p95_ms": round(pp), "error_rate": round(pe, 3)}})
    result = {"id": pr["id"], "score_base": score_base, "score_pr": score_pr,
              "verdict": "regression" if score_pr < score_base else "pass",
              "per_scenario": per, "findings": findings,
              "cascade_path": ["database", "inventory", "order", "gateway", "frontend"] if findings else [],
              "diff": pr_diff(pr_id), "comment": ""}
    result["comment"] = render_comment(result)
    return result


def heal_pr(pr_id: int):
    """Returns the HealResponse dict (Section 10) or None if the PR does not exist."""
    pr = get_pr(pr_id)
    if not pr:
        return None
    current = get_pr_edges(pr_id)
    findings = scan(base_edges=BASE_EDGES, pr_edges=current)
    healed = heal_pr_edges(pr_edges=current, findings=findings)
    g = run_gate(pr_edges=current, patched_edges=healed.edges, patch_diff=healed.patch_diff, pr_id=pr["id"])
    return {"id": g["id"], "gate": g["gate"], "reason": g["reason"],
            "score_before": g["score_before"], "score_after": g["score_after"],
            "patch_diff": g["patch_diff"], "per_scenario_after": g["per_scenario_after"],
            "verified_under": g["verified_under"]}
