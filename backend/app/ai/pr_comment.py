"""Owner: Vaishnavi. Deterministic GitHub-style Markdown PR comment generator.
Renders structured PR analysis results into a clear resilience review comment:
1. Verdict line with score delta
2. Per-scenario metrics table (Base vs This PR)
3. Top finding from scanner
4. Cascade propagation path
5. Suggested Auto-Fix remediation
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

SCENARIO_LABELS: Dict[str, str] = {
    "db_latency": "Database latency",
    "service_down": "Service down",
    "traffic_spike": "Traffic spike",
}


def _format_pct(val: float) -> str:
    """Format a fractional rate (e.g. 0.028) as a percentage string (2.8%)."""
    return f"{val * 100:.1f}%"


def _build_suggested_fix(findings: List[Dict[str, Any]]) -> str:
    """Derive suggested remediation steps deterministically from findings."""
    if not findings:
        return "None required. Pull request maintains baseline resilience."

    rules = {f.get("rule") for f in findings if f.get("rule")}
    steps: List[str] = []

    if "R1_TIMEOUT" in rules:
        steps.append("restore timeout_ms 700")
    if "R2_RETRY_STORM" in rules:
        steps.append("bound retries to 1")
    if "R3_NO_FALLBACK" in rules:
        steps.append("re-enable breaker and fallback")

    if not steps:
        return f"Address {findings[0].get('edge', 'dependency')} configuration: {findings[0].get('message', '')}"

    return ", ".join(steps) + "."


def render_comment(analysis: Dict[str, Any]) -> str:
    """Render a GitHub-style markdown PR resilience comment from structured analysis data.

    Expected fields in `analysis`:
    - score_base: int (e.g. 84)
    - score_pr: int (e.g. 32)
    - verdict: Optional[str] ("regression", "safe", etc.)
    - per_scenario: List[Dict] with scenario, base {p95_ms, error_rate}, pr {p95_ms, error_rate}
    - findings: List[Dict] with rule, severity, edge, message, evidence
    - cascade_path: List[str] representing node sequence (e.g. ["database", "inventory", ...])
    - suggested_fix: Optional[str] (derived automatically if omitted)
    """
    score_base = analysis.get("score_base", 84)
    score_pr = analysis.get("score_pr", 84)
    verdict_str = analysis.get("verdict", "")

    # 1. Verdict & Score Delta
    if verdict_str:
        verdict_clean = verdict_str.strip().capitalize()
        verdict_label = f"**{verdict_clean}.**"
    elif score_pr < score_base:
        verdict_label = "**Regression.**"
    elif score_pr > score_base:
        verdict_label = "**Improvement.**"
    else:
        verdict_label = "**No change.**"

    lines: List[str] = [
        "### FLOWGUARD Resilience Check",
        f"{verdict_label} Resilience {score_base} -> {score_pr}",
        "",
        "| Scenario | Base (p95 / errors) | This PR |",
        "|---|---|---|",
    ]

    # 2. Per-Scenario Table
    per_scenario = analysis.get("per_scenario", [])
    for row in per_scenario:
        sc_key = row.get("scenario", "")
        sc_name = SCENARIO_LABELS.get(sc_key, sc_key.replace("_", " ").capitalize())

        base_data = row.get("base", {})
        pr_data = row.get("pr", {})

        b_p95 = base_data.get("p95_ms", 0)
        b_err = base_data.get("error_rate", 0.0)
        base_cell = f"{b_p95} ms / {_format_pct(b_err)}"

        p_p95 = pr_data.get("p95_ms", 0)
        p_err = pr_data.get("error_rate", 0.0)
        pr_cell = f"{p_p95} ms / {_format_pct(p_err)}"

        lines.append(f"| {sc_name} | {base_cell} | {pr_cell} |")

    # 3. Top Finding
    findings = analysis.get("findings", [])
    lines.append("")
    if findings:
        top_finding = findings[0]
        msg = top_finding.get("message") or top_finding.get("rule", "Issue detected")
        lines.append(f"Top finding: {msg}")
    else:
        lines.append("Top finding: None (no configuration risks identified).")

    # 4. Cascade Path
    cascade_nodes = analysis.get("cascade_path", [])
    if cascade_nodes:
        path_str = " -> ".join(n.capitalize() for n in cascade_nodes)
        lines.append(f"Cascade: {path_str}")
    else:
        lines.append("Cascade: None (no cascading failure observed).")

    # 5. Suggested Fix
    suggested_fix = analysis.get("suggested_fix")
    if not suggested_fix:
        suggested_fix = _build_suggested_fix(findings)

    lines.append("")
    lines.append(f"Suggested fix: {suggested_fix}")

    return "\n".join(lines)
