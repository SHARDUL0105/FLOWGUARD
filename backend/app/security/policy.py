"""Security policy evaluation engine.
Applies configurable policy thresholds to normalized findings and scanner execution statuses.
Ensures failed scanners can NEVER result in a PASS verdict.
"""
from __future__ import annotations

from typing import List, Optional, Set
from .models import NormalizedFinding, PolicyEvaluationResult, PolicyVerdict, ScannerExecutionMetadata

POLICY_VERSION = "1.0.0"
DEFAULT_BLOCKING_SEVERITIES: Set[str] = {"critical", "high"}


def evaluate_security_policy(
    findings: List[NormalizedFinding],
    scanners: List[ScannerExecutionMetadata],
    blocking_severities: Optional[Set[str]] = None,
    exempt_rules: Optional[Set[str]] = None,
) -> PolicyEvaluationResult:
    """Evaluate normalized findings and scanner health against the security policy.

    Rules:
    1. If any executed scanner experienced an internal execution failure, verdict is 'error'.
       (Never return PASS when a scanner failed).
    2. Any finding with severity in blocking_severities causes verdict 'fail'.
    3. If zero blocking findings and all required scanners succeeded (or reported clean), verdict is 'pass'.
    """
    if blocking_severities is None:
        blocking_severities = DEFAULT_BLOCKING_SEVERITIES
    if exempt_rules is None:
        exempt_rules = set()

    # Rule 1: Scanner failure check
    failed_scanners = [s for s in scanners if s.status == "failed"]
    if failed_scanners:
        names = ", ".join(s.scanner for s in failed_scanners)
        return PolicyEvaluationResult(
            verdict="error",
            passed=False,
            blocking_findings_count=0,
            summary=f"Security scan incomplete: scanner(s) [{names}] encountered execution failures.",
            policy_version=POLICY_VERSION,
        )

    # Count findings by severity
    critical_c = 0
    high_c = 0
    medium_c = 0
    low_c = 0
    info_c = 0
    blocking_c = 0

    for f in findings:
        if f.rule_id in exempt_rules:
            continue

        sev = f.severity.lower()
        if sev == "critical":
            critical_c += 1
        elif sev == "high":
            high_c += 1
        elif sev == "medium":
            medium_c += 1
        elif sev == "low":
            low_c += 1
        else:
            info_c += 1

        if sev in blocking_severities:
            blocking_c += 1

    if blocking_c > 0:
        summary = f"Security Policy FAIL: {blocking_c} blocking vulnerabilities detected ({critical_c} critical, {high_c} high)."
        verdict: PolicyVerdict = "fail"
        passed = False
    else:
        if len(findings) == 0:
            summary = "Security Policy PASS: Clean scan with zero security findings."
        else:
            summary = f"Security Policy PASS: {len(findings)} non-blocking advisory findings ({medium_c} medium, {low_c} low)."
        verdict = "pass"
        passed = True

    return PolicyEvaluationResult(
        verdict=verdict,
        passed=passed,
        blocking_findings_count=blocking_c,
        critical_count=critical_c,
        high_count=high_c,
        medium_count=medium_c,
        low_count=low_c,
        info_count=info_c,
        summary=summary,
        policy_version=POLICY_VERSION,
    )
