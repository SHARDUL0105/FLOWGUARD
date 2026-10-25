"""Patch security revalidation.
Re-scans patched configurations/diffs to confirm that flagged security vulnerabilities
have been resolved without introducing new flaws or regressions.
"""
from __future__ import annotations

from typing import Any, List, Optional, Tuple

from .models import NormalizedFinding, SecurityScanReport
from .secret_scanner import scan_diff_for_secrets
from .policy import evaluate_security_policy


def revalidate_security_patch(
    original_report: SecurityScanReport,
    patched_diff: str,
    pr_id: Any,
    tenant_id: str = "demo",
) -> Tuple[bool, SecurityScanReport, str]:
    """Revalidate a proposed security or reliability patch.

    Args:
        original_report: Previous scan report before patch.
        patched_diff: Unified diff representing the proposed patch.
        pr_id: PR identifier.
        tenant_id: Organization tenant identifier.

    Returns:
        Tuple of (is_verified: bool, revalidated_report: SecurityScanReport, explanation: str).
    """
    from .orchestrator import scan_pr_security

    # Perform fresh security scan on the patched diff
    new_report = scan_pr_security(
        pr_id=pr_id,
        tenant_id=tenant_id,
        diff_override=patched_diff,
    )

    original_finding_ids = {f.id for f in original_report.findings}
    current_finding_ids = {f.id for f in new_report.findings}

    resolved_count = len(original_finding_ids - current_finding_ids)
    introduced_count = len(current_finding_ids - original_finding_ids)

    # Determine whether the patch meets acceptance criteria
    if new_report.policy.verdict == "error":
        is_verified = False
        summary = f"Patch revalidation error: {new_report.policy.summary}"
    elif new_report.policy.passed and introduced_count == 0:
        is_verified = True
        summary = f"Patch security verified: {resolved_count} vulnerabilities resolved, 0 new flaws introduced. Policy PASS."
    elif not new_report.policy.passed:
        is_verified = False
        summary = f"Patch security rejected: {new_report.policy.blocking_findings_count} blocking findings remain in patched state."
    else:
        is_verified = False
        summary = f"Patch security rejected: {introduced_count} new security flaws introduced by the patch."

    return is_verified, new_report, summary


# Alias for concise import
revalidate_patch = revalidate_security_patch

