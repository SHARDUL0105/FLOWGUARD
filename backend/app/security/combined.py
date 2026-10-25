"""Combined PR Verification Evaluator (Phase 4).
Consumes existing reliability results and security results to compute the PR-level decision matrix.
Guarantees that high reliability scores can NEVER cancel out security failures, preserves
separate reports, and enforces that ELIGIBLE_FOR_REVIEW is not an automatic merge authorization.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from ..pr.service import analyze_pr
from .models import SecurityScanReport
from .orchestrator import scan_pr_security

CombinedStatus = Literal[
    "ELIGIBLE_FOR_REVIEW",
    "BLOCKED_SECURITY",
    "BLOCKED_RELIABILITY",
    "BLOCKED_BOTH",
    "BLOCKED_CHECKS_INCOMPLETE",
]

PipelineStatus = Literal["PASS", "FAIL", "INCOMPLETE"]


class ReliabilitySummary(BaseModel):
    """Summary of the reliability pipeline execution."""
    status: PipelineStatus = Field(description="PASS | FAIL | INCOMPLETE")
    score: int = Field(description="Pure resilience score for the PR (0-100)")
    score_base: int = Field(description="Baseline system resilience score (84)")
    verdict: str = Field(description="pass | regression | error")
    findings_count: int = Field(default=0, description="Count of resilience scanner findings (R1, R2, R3)")
    report: Optional[Dict[str, Any]] = Field(default=None, description="Full unmodified AnalyzeResponse payload")


class SecuritySummary(BaseModel):
    """Summary of the security pipeline execution."""
    status: PipelineStatus = Field(description="PASS | FAIL | INCOMPLETE")
    blocking_findings_count: int = Field(default=0, description="Count of policy-blocking security flaws")
    critical_count: int = Field(default=0)
    high_count: int = Field(default=0)
    secrets_count: int = Field(default=0)
    policy_verdict: str = Field(description="PASS | FAIL | INCOMPLETE")
    report: Optional[Dict[str, Any]] = Field(default=None, description="Full unmodified SecurityScanReport payload")


class CombinedVerificationResult(BaseModel):
    """Unified PR-level gate result combining independent reliability and security evaluations."""
    pr_id: Any = Field(description="Associated pull request ID")
    tenant_id: str = Field(default="demo", description="Tenant isolation scope")
    timestamp: str = Field(description="Evaluation timestamp in ISO-8601 UTC")
    combined_status: CombinedStatus = Field(description="Final combined gate outcome from the decision matrix")
    
    # Eligibility & Review Controls
    eligible_for_review: bool = Field(
        description="True ONLY if both reliability and security passed. Pre-condition for human reviewer approval."
    )
    automatic_merge_authorized: bool = Field(
        default=False,
        description="Always False. ELIGIBLE_FOR_REVIEW is never an automatic merge authorization."
    )
    review_signoff_required: bool = Field(
        default=True,
        description="Human reviewer sign-off is mandatory before any simulated or real merge."
    )
    all_checks_completed: bool = Field(
        description="True if all mandatory reliability and security scans completed without execution failures."
    )
    
    # Preserved Sub-pipeline Reports
    reliability: ReliabilitySummary
    security: SecuritySummary
    
    # Machine-Readable Justifications
    machine_readable_reasons: List[str] = Field(
        default_factory=list,
        description="Deterministic machine-readable tokens explaining the combined decision."
    )
    decision_summary: str = Field(description="Human-readable explanation of the combined verdict.")


def extract_reliability_status(rel_report: Optional[Dict[str, Any]]) -> tuple[PipelineStatus, ReliabilitySummary]:
    """Extract and normalize status from the existing AnalyzeResponse dictionary."""
    if not rel_report or not isinstance(rel_report, dict) or rel_report.get("verdict") in ("error", "incomplete") or rel_report.get("status") == "INCOMPLETE":
        summary = ReliabilitySummary(
            status="INCOMPLETE",
            score=rel_report.get("score_pr", 0) if isinstance(rel_report, dict) else 0,
            score_base=rel_report.get("score_base", 84) if isinstance(rel_report, dict) else 84,
            verdict=rel_report.get("verdict", "error") if isinstance(rel_report, dict) else "error",
            findings_count=0,
            report=rel_report if isinstance(rel_report, dict) else None,
        )
        return "INCOMPLETE", summary

    score_pr = rel_report.get("score_pr", 0)
    score_base = rel_report.get("score_base", 84)
    verdict = rel_report.get("verdict", "").lower()
    findings = rel_report.get("findings", [])

    # Reliability rules: Pass only if verdict is 'pass' and score meets baseline
    if verdict == "pass" and score_pr >= score_base:
        status: PipelineStatus = "PASS"
    elif verdict in ("regression", "fail") or score_pr < score_base:
        status = "FAIL"
    else:
        status = "INCOMPLETE"

    summary = ReliabilitySummary(
        status=status,
        score=score_pr,
        score_base=score_base,
        verdict=verdict or "unknown",
        findings_count=len(findings),
        report=rel_report,
    )
    return status, summary


def extract_security_status(sec_report: Optional[SecurityScanReport]) -> tuple[PipelineStatus, SecuritySummary]:
    """Extract and normalize status from the SecurityScanReport model."""
    if not sec_report or not isinstance(sec_report, SecurityScanReport):
        summary = SecuritySummary(
            status="INCOMPLETE",
            blocking_findings_count=0,
            critical_count=0,
            high_count=0,
            secrets_count=0,
            policy_verdict="INCOMPLETE",
            report=None,
        )
        return "INCOMPLETE", summary

    pol = sec_report.policy
    v = pol.verdict.upper()

    if v == "INCOMPLETE" or sec_report.has_failures:
        status: PipelineStatus = "INCOMPLETE"
    elif v == "PASS" and pol.passed:
        status = "PASS"
    else:
        status = "FAIL"

    summary = SecuritySummary(
        status=status,
        blocking_findings_count=pol.blocking_findings_count,
        critical_count=pol.critical_count,
        high_count=pol.high_count,
        secrets_count=pol.exposed_secrets_count,
        policy_verdict=v,
        report=sec_report.model_dump(),
    )
    return status, summary


def evaluate_combined_matrix(
    reliability_status: PipelineStatus,
    security_status: PipelineStatus,
    rel_summary: ReliabilitySummary,
    sec_summary: SecuritySummary,
    pr_id: Any,
    tenant_id: str = "demo",
) -> CombinedVerificationResult:
    """Apply the deterministic 4-quadrant decision matrix + incomplete handling:

    | Reliability | Security | Combined result |
    | PASS | PASS | ELIGIBLE_FOR_REVIEW |
    | PASS | FAIL | BLOCKED_SECURITY |
    | FAIL | PASS | BLOCKED_RELIABILITY |
    | FAIL | FAIL | BLOCKED_BOTH |
    | INCOMPLETE (either) | BLOCKED_CHECKS_INCOMPLETE |
    """
    now_utc = datetime.now(timezone.utc).isoformat()
    reasons: List[str] = []

    # Rule 1: Checks incomplete
    if reliability_status == "INCOMPLETE" or security_status == "INCOMPLETE":
        combined_status: CombinedStatus = "BLOCKED_CHECKS_INCOMPLETE"
        eligible = False
        all_completed = False
        if reliability_status == "INCOMPLETE":
            reasons.append("RELIABILITY_INCOMPLETE: Reliability simulation or fault analysis failed to execute.")
        if security_status == "INCOMPLETE":
            reasons.append("SECURITY_INCOMPLETE: Required security scanners or test suite failed to complete.")
        reasons.append("DECISION_GATE: All mandatory checks must complete before review eligibility.")
        summary_text = (
            "Verification BLOCKED: One or more required reliability or security checks are INCOMPLETE. "
            "PR cannot be evaluated for review until all scanners complete."
        )

    # Rule 2: Both PASS -> ELIGIBLE_FOR_REVIEW
    elif reliability_status == "PASS" and security_status == "PASS":
        combined_status = "ELIGIBLE_FOR_REVIEW"
        eligible = True
        all_completed = True
        reasons.append(f"RELIABILITY_PASS: Resilience score {rel_summary.score}/{rel_summary.score_base} meets baseline without regression.")
        reasons.append("SECURITY_PASS: Clean scan with 0 blocking security vulnerabilities across all tools.")
        reasons.append("REVIEW_REQUIRED: PR is eligible for human review. Peer or admin sign-off required before merge.")
        summary_text = (
            f"Verification PASS: Resilience ({rel_summary.score}/100) and Security checks passed cleanly. "
            "PR is ELIGIBLE_FOR_REVIEW. (Notice: Automatic merge is not authorized; reviewer approval required)."
        )

    # Rule 3: Reliability PASS, Security FAIL -> BLOCKED_SECURITY
    elif reliability_status == "PASS" and security_status == "FAIL":
        combined_status = "BLOCKED_SECURITY"
        eligible = False
        all_completed = True
        reasons.append(f"RELIABILITY_PASS: Resilience score {rel_summary.score}/{rel_summary.score_base} meets baseline.")
        reasons.append(
            f"SECURITY_FAIL: Security policy blocked with {sec_summary.blocking_findings_count} blocking flaw(s) "
            f"({sec_summary.secrets_count} secrets, {sec_summary.critical_count} critical, {sec_summary.high_count} high)."
        )
        reasons.append("POLICY_OVERRIDE_PREVENTION: High resilience score CANNOT cancel out or override security violations.")
        summary_text = (
            f"Verification BLOCKED by Security Policy: {sec_summary.blocking_findings_count} blocking vulnerability detected. "
            f"Resilience score ({rel_summary.score}) does not override security failures. Merge blocked."
        )

    # Rule 4: Reliability FAIL, Security PASS -> BLOCKED_RELIABILITY
    elif reliability_status == "FAIL" and security_status == "PASS":
        combined_status = "BLOCKED_RELIABILITY"
        eligible = False
        all_completed = True
        reasons.append(
            f"RELIABILITY_FAIL: Resilience score {rel_summary.score}/{rel_summary.score_base} indicates service regression "
            f"({rel_summary.findings_count} architectural fault findings)."
        )
        reasons.append("SECURITY_PASS: Clean scan with zero blocking security flaws.")
        reasons.append("RELIABILITY_GATE: Auto-Fix or configuration remediation required to recover baseline score.")
        summary_text = (
            f"Verification BLOCKED by Reliability Gate: Resilience score dropped to {rel_summary.score}/100 (baseline {rel_summary.score_base}). "
            "Security checks passed, but reliability regression blocks merge eligibility."
        )

    # Rule 5: Both FAIL -> BLOCKED_BOTH
    else:
        combined_status = "BLOCKED_BOTH"
        eligible = False
        all_completed = True
        reasons.append(f"RELIABILITY_FAIL: Score {rel_summary.score}/{rel_summary.score_base} regressed under fault scenarios.")
        reasons.append(f"SECURITY_FAIL: {sec_summary.blocking_findings_count} policy-blocking security flaw(s) detected.")
        reasons.append("DUAL_GATE_FAILURE: Both reliability and security criteria failed. Remediate resilience and security before retry.")
        summary_text = (
            f"Verification BLOCKED (Dual Failure): Both Reliability (Score: {rel_summary.score}) "
            f"and Security ({sec_summary.blocking_findings_count} blocking flaws) failed. Merge blocked."
        )

    return CombinedVerificationResult(
        pr_id=pr_id,
        tenant_id=tenant_id,
        timestamp=now_utc,
        combined_status=combined_status,
        eligible_for_review=eligible,
        automatic_merge_authorized=False,
        review_signoff_required=True,
        all_checks_completed=all_completed,
        reliability=rel_summary,
        security=sec_summary,
        machine_readable_reasons=reasons,
        decision_summary=summary_text,
    )


def verify_pr_combined(
    pr_id: Any,
    tenant_id: str = "demo",
    reliability_report: Optional[Dict[str, Any]] = None,
    security_report: Optional[SecurityScanReport] = None,
    diff_override: Optional[str] = None,
) -> CombinedVerificationResult:
    """Run or assemble both pipelines and compute the combined PR verification result."""
    # 1. Resolve or compute Reliability Report
    if reliability_report is None:
        try:
            numeric_id = int(str(pr_id).replace("pr", "").replace("#", "").strip())
            reliability_report = analyze_pr(numeric_id)
        except Exception:
            reliability_report = None

    rel_status, rel_summary = extract_reliability_status(reliability_report)

    # 2. Resolve or compute Security Report
    if security_report is None:
        try:
            security_report = scan_pr_security(
                pr_id=pr_id,
                tenant_id=tenant_id,
                diff_override=diff_override,
            )
        except Exception:
            security_report = None

    sec_status, sec_summary = extract_security_status(security_report)

    # 3. Evaluate Combined Matrix
    return evaluate_combined_matrix(
        reliability_status=rel_status,
        security_status=sec_status,
        rel_summary=rel_summary,
        sec_summary=sec_summary,
        pr_id=pr_id,
        tenant_id=tenant_id,
    )
