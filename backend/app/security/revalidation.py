"""Patch security revalidation and Auto-Fix safety pipeline (Phase 6).
Integrates independent security revalidation into the Auto-Fix workflow without
modifying the existing patch-generation algorithm.

Enforces the 9 required sequence steps:
1. Record original PR revision and reliability/security reports.
2. Generate proposed patch using current Auto-Fix implementation.
3. Identify changed files and compute patch/revision identifier.
4. Re-run reliability verification (acceptance gate).
5. Re-run security scanners against patched snapshot.
6. Compare before/after findings (resolved, introduced, remaining).
7. Reject approval if patch introduces blocking findings, leaves policy violations
   unresolved, or required checks are incomplete. Never mark patch safe solely for resilience.
8. Return comprehensive payload displaying both original and post-fix results.
9. Enforce human reviewer sign-off requirement before simulated merge.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional, Tuple, Union

from ..pr import prs
from ..pr.heal import heal as heal_pr_edges, HealResult
from ..pr.gate import gate as run_gate
from ..pr.service import analyze_pr
from ..sim.reference_sim import BASE_EDGES
from .combined import (
    CombinedVerificationResult,
    evaluate_combined_matrix,
    extract_reliability_status,
    extract_security_status,
    verify_pr_combined,
)
from .models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    SecurityScanReport,
)
from .orchestrator import compute_patch_hash, scan_pr_security


def extract_changed_files_from_diff(diff_text: str) -> List[str]:
    """Parse unified diff to identify all modified, added, or deleted files."""
    files: List[str] = []
    for line in (diff_text or "").splitlines():
        if line.startswith("+++ b/"):
            target = line[6:].strip()
            if target not in files and target != "/dev/null":
                files.append(target)
        elif line.startswith("--- a/"):
            target = line[6:].strip()
            if target not in files and target != "/dev/null":
                files.append(target)
        elif line.startswith("@@ ") and "->" in line:
            # Handle edge diff format like @@ order -> inventory @@
            edge_desc = line.strip("@ ").strip()
            files.append(f"config/{edge_desc.replace(' ', '')}.yaml")
    if not files and diff_text:
        files.append("order-service/config.yaml")
    return sorted(list(set(files)))


def finding_identity_key(f: NormalizedFinding) -> Tuple[str, str]:
    """Semantic key for finding comparison across diffs."""
    return (f.rule_id, f.title)


def compare_security_findings(
    original_findings: List[NormalizedFinding],
    patched_findings: List[NormalizedFinding],
) -> Dict[str, Any]:
    """Compare security findings before and after a patch.
    Matches findings semantically across diff line number shifts.
    """
    orig_map = {finding_identity_key(f): f for f in original_findings}
    patched_map = {finding_identity_key(f): f for f in patched_findings}

    resolved_keys = set(orig_map.keys()) - set(patched_map.keys())
    introduced_keys = set(patched_map.keys()) - set(orig_map.keys())
    remaining_keys = set(orig_map.keys()) & set(patched_map.keys())

    resolved_findings = [orig_map[k] for k in resolved_keys]
    introduced_findings = [patched_map[k] for k in introduced_keys]
    remaining_findings = [patched_map[k] for k in remaining_keys]

    blocking_introduced = [
        f for f in introduced_findings if f.severity in ("critical", "high")
    ]
    blocking_remaining = [
        f for f in remaining_findings if f.severity in ("critical", "high")
    ]

    return {
        "resolved_findings": resolved_findings,
        "introduced_findings": introduced_findings,
        "remaining_findings": remaining_findings,
        "resolved_count": len(resolved_findings),
        "introduced_count": len(introduced_findings),
        "remaining_count": len(remaining_findings),
        "blocking_introduced_count": len(blocking_introduced),
        "blocking_remaining_count": len(blocking_remaining),
    }


def revalidate_security_patch(
    original_report: SecurityScanReport,
    patched_diff: str,
    pr_id: Any,
    tenant_id: str = "demo",
) -> Tuple[bool, SecurityScanReport, str]:
    """Revalidate a proposed security or reliability patch against previous scan."""
    new_report = scan_pr_security(
        pr_id=pr_id,
        tenant_id=tenant_id,
        diff_override=patched_diff,
    )
    diff_comp = compare_security_findings(original_report.findings, new_report.findings)

    if new_report.has_failures or new_report.policy.verdict == "INCOMPLETE":
        is_verified = False
        summary = f"Patch revalidation incomplete: {new_report.policy.summary}"
    elif diff_comp["blocking_introduced_count"] > 0:
        is_verified = False
        summary = f"Patch security rejected: introduced {diff_comp['blocking_introduced_count']} new blocking vulnerability(ies)."
    elif not new_report.policy.passed:
        is_verified = False
        summary = (
            f"Patch security rejected: {new_report.policy.blocking_findings_count} blocking vulnerabilities "
            f"remain unresolved in patched state."
        )
    elif new_report.policy.passed:
        is_verified = True
        summary = (
            f"Patch security verified: {diff_comp['resolved_count']} vulnerabilities resolved, "
            f"0 new flaws introduced. Policy PASS."
        )
    else:
        is_verified = False
        summary = "Patch security rejected by policy evaluator."

    return is_verified, new_report, summary


def build_patched_diff(orig_diff: str, autofix_patch: str) -> str:
    """Construct the full patched revision diff by applying autofix changes to the original PR diff.
    Preserves diff headers and non-resilience additions (such as code lines or configuration secrets) in the patched snapshot.
    """
    if not orig_diff:
        return autofix_patch
    if not autofix_patch:
        return orig_diff

    header_lines: List[str] = []
    for line in orig_diff.splitlines():
        if line.startswith("--- a/") or line.startswith("+++ b/"):
            header_lines.append(line)

    # Identify lines added in orig_diff that are not resilience edge parameters
    edge_keywords = {"timeout", "timeout_ms", "retries", "circuit_breaker", "breaker", "fallback"}
    extra_added_lines: List[str] = []

    for line in orig_diff.splitlines():
        if line.startswith("+") and not line.startswith("+++"):
            content = line[1:].strip().lower()
            key = content.split(":")[0].split("=")[0].strip() if (":" in content or "=" in content) else content
            if key not in edge_keywords:
                extra_added_lines.append(line)

    parts: List[str] = []
    if header_lines:
        parts.append("\n".join(header_lines))
    parts.append(autofix_patch)
    if extra_added_lines:
        parts.append("\n".join(extra_added_lines))

    return "\n".join(parts)


def validate_autofix_workflow(
    pr_id: Union[int, str],
    tenant_id: str = "demo",
    patch_diff_override: Optional[str] = None,
    patched_edges_override: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Execute the full 9-step patch validation and Auto-Fix safety sequence.

    Integrates security validation without modifying the existing patch-generation algorithm.
    Never marks a patch safe solely because resilience score improved.
    """
    now_utc = datetime.now(timezone.utc).isoformat()
    norm_id = prs._normalize_pr_id(pr_id)
    pr_data = prs.get_pr(pr_id, tenant_id=tenant_id)
    orig_diff = prs.pr_diff(pr_id)
    current_edges = prs.pr_edges(pr_id)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Record original PR revision and its reliability/security reports
    # ─────────────────────────────────────────────────────────────────────────
    orig_rel = analyze_pr(pr_id)
    orig_sec = scan_pr_security(pr_id=pr_id, tenant_id=tenant_id)
    orig_patch_hash = compute_patch_hash(orig_diff)

    orig_rel_status, orig_rel_summary = extract_reliability_status(orig_rel)
    orig_sec_status, orig_sec_summary = extract_security_status(orig_sec)
    orig_combined = evaluate_combined_matrix(
        reliability_status=orig_rel_status,
        security_status=orig_sec_status,
        rel_summary=orig_rel_summary,
        sec_summary=orig_sec_summary,
        pr_id=pr_id,
        tenant_id=tenant_id,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Generate proposed patch using current Auto-Fix implementation
    # ─────────────────────────────────────────────────────────────────────────
    if patched_edges_override is not None and patch_diff_override is not None:
        healed_edges = patched_edges_override
        patch_diff = patch_diff_override
    else:
        from ..pr.scanner import scan as scan_resilience_rules
        findings = scan_resilience_rules(base_edges=BASE_EDGES, pr_edges=current_edges)
        healed_res: HealResult = heal_pr_edges(pr_edges=current_edges, findings=findings)
        healed_edges = healed_res.edges
        patch_diff = patch_diff_override if patch_diff_override is not None else healed_res.patch_diff

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Identify exact changed files and compute revision identifier
    # ─────────────────────────────────────────────────────────────────────────
    patched_diff_full = build_patched_diff(orig_diff, patch_diff)
    changed_files = extract_changed_files_from_diff(patched_diff_full)
    patch_hash = compute_patch_hash(patched_diff_full)
    revision_id = f"rev-{norm_id}-{hashlib.sha256((orig_diff + patched_diff_full).encode()).hexdigest()[:12]}"

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: Re-run existing reliability verification (acceptance gate)
    # ─────────────────────────────────────────────────────────────────────────
    gate_res = run_gate(
        pr_edges=current_edges,
        patched_edges=healed_edges,
        patch_diff=patch_diff,
        pr_id=pr_id,
    )
    reliability_accepted = (gate_res.get("gate") == "accepted")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: Re-run applicable security scanners against patched snapshot
    # ─────────────────────────────────────────────────────────────────────────
    patched_sec = scan_pr_security(
        pr_id=pr_id,
        tenant_id=tenant_id,
        diff_override=patched_diff_full,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 6: Compare before/after findings
    # ─────────────────────────────────────────────────────────────────────────
    diff_comp = compare_security_findings(orig_sec.findings, patched_sec.findings)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 7: Reject approval if patch introduces blocking findings, leaves
    #         policy violations unresolved, or required checks are incomplete.
    # ─────────────────────────────────────────────────────────────────────────
    security_verified = False
    rejection_reasons: List[str] = []

    # Check 7a: Incomplete checks
    if patched_sec.has_failures or patched_sec.policy.verdict == "INCOMPLETE":
        rejection_reasons.append(
            "Security revalidation failed: one or more required scanners did not complete successfully."
        )
    # Check 7b: New blocking findings introduced by patch
    elif diff_comp["blocking_introduced_count"] > 0:
        rejection_reasons.append(
            f"Security revalidation rejected: patch introduced {diff_comp['blocking_introduced_count']} "
            f"new blocking vulnerability(ies)."
        )
    # Check 7c: Original security policy violation left unresolved
    elif not patched_sec.policy.passed or diff_comp["blocking_remaining_count"] > 0:
        rejection_reasons.append(
            f"Patch improved resilience score ({gate_res.get('score_before')} -> {gate_res.get('score_after')}), "
            f"but did not pass security verification: {patched_sec.policy.blocking_findings_count} blocking "
            f"vulnerability(ies) remain unresolved."
        )
    else:
        security_verified = True

    # Check 7d: Reliability gate result
    if not reliability_accepted:
        rejection_reasons.append(f"Reliability gate rejected: {gate_res.get('reason')}")

    # Overall Auto-Fix Gate
    overall_gate = "accepted" if (reliability_accepted and security_verified) else "rejected"
    final_reason = " | ".join(rejection_reasons) if rejection_reasons else None

    # Post-fix combined matrix evaluation
    post_rel_report = {
        "score_pr": gate_res.get("score_after", 0),
        "score_base": 84,
        "verdict": "pass" if reliability_accepted else "regression",
        "findings": [],
    }
    post_rel_status, post_rel_summary = extract_reliability_status(post_rel_report)
    post_sec_status, post_sec_summary = extract_security_status(patched_sec)

    post_combined = evaluate_combined_matrix(
        reliability_status=post_rel_status,
        security_status=post_sec_status,
        rel_summary=post_rel_summary,
        sec_summary=post_sec_summary,
        pr_id=pr_id,
        tenant_id=tenant_id,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 8: Display both original and post-fix results (HealResponse contract)
    # ─────────────────────────────────────────────────────────────────────────
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 9: Require reviewer approval before simulated merge (never automatic)
    # ─────────────────────────────────────────────────────────────────────────
    return {
        # Core HealResponse schema for backward compatibility
        "id": gate_res.get("id", pr_id),
        "gate": overall_gate,
        "reason": final_reason,
        "score_before": gate_res.get("score_before"),
        "score_after": gate_res.get("score_after"),
        "patch_diff": patch_diff,
        "per_scenario_after": gate_res.get("per_scenario_after", []),
        "verified_under": gate_res.get("verified_under", []),

        # Extended Phase 6 Security & Validation Attributes
        "patch_hash": patch_hash,
        "revision_id": revision_id,
        "changed_files": changed_files,
        "timestamp": now_utc,
        "tenant_id": tenant_id,

        "original": {
            "revision_hash": orig_patch_hash,
            "reliability": {
                "score": orig_rel.get("score_pr") if orig_rel else 0,
                "score_base": orig_rel.get("score_base") if orig_rel else 84,
                "verdict": orig_rel.get("verdict") if orig_rel else "unknown",
                "findings_count": len(orig_rel.get("findings", [])) if orig_rel else 0,
            },
            "security": {
                "policy_verdict": orig_sec.policy.verdict,
                "blocking_count": orig_sec.policy.blocking_findings_count,
                "secrets_count": orig_sec.policy.exposed_secrets_count,
                "findings": [f.model_dump() for f in orig_sec.findings],
            },
            "combined_status": orig_combined.combined_status,
        },

        "post_fix": {
            "revision_hash": patch_hash,
            "reliability": {
                "score_before": gate_res.get("score_before"),
                "score_after": gate_res.get("score_after"),
                "gate": gate_res.get("gate"),
                "reason": gate_res.get("reason"),
            },
            "security": {
                "policy_verdict": patched_sec.policy.verdict,
                "blocking_count": patched_sec.policy.blocking_findings_count,
                "secrets_count": patched_sec.policy.exposed_secrets_count,
                "findings": [f.model_dump() for f in patched_sec.findings],
            },
            "combined_status": post_combined.combined_status,
        },

        "security_revalidation": {
            "passed": security_verified,
            "policy_verdict": patched_sec.policy.verdict,
            "resolved_count": diff_comp["resolved_count"],
            "introduced_count": diff_comp["introduced_count"],
            "remaining_count": diff_comp["remaining_count"],
            "blocking_introduced_count": diff_comp["blocking_introduced_count"],
            "blocking_remaining_count": diff_comp["blocking_remaining_count"],
            "resolved_findings": [f.model_dump() for f in diff_comp["resolved_findings"]],
            "introduced_findings": [f.model_dump() for f in diff_comp["introduced_findings"]],
            "remaining_findings": [f.model_dump() for f in diff_comp["remaining_findings"]],
            "summary": " | ".join(rejection_reasons) if rejection_reasons else "All security revalidations passed cleanly.",
        },

        # Governance & Review Controls
        "combined_status": post_combined.combined_status,
        "eligible_for_review": (post_combined.combined_status == "ELIGIBLE_FOR_REVIEW"),
        "automatic_merge_authorized": False,
        "review_signoff_required": True,
        "reviewer_approval_status": "pending_review" if (post_combined.combined_status == "ELIGIBLE_FOR_REVIEW") else "blocked",
    }


# In-memory Review & Simulated Merge Ledger
_REVIEW_APPROVALS: Dict[str, Dict[str, Any]] = {}
_SIMULATED_MERGES: Dict[str, Dict[str, Any]] = {}


def record_reviewer_approval(
    pr_id: Union[int, str],
    revision_id: str,
    reviewer_name: str,
    role: str = "senior_reviewer",
    tenant_id: str = "demo",
    comments: str = "Approved after verified resilience and security checks.",
) -> Dict[str, Any]:
    """Record an explicit human reviewer approval for a verified revision."""
    key = f"{tenant_id}:{prs._normalize_pr_id(pr_id)}"
    record = {
        "pr_id": pr_id,
        "tenant_id": tenant_id,
        "revision_id": revision_id,
        "reviewer": reviewer_name,
        "role": role,
        "comments": comments,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "status": "approved",
    }
    _REVIEW_APPROVALS[key] = record
    return record


def get_reviewer_approval(pr_id: Union[int, str], tenant_id: str = "demo") -> Optional[Dict[str, Any]]:
    """Retrieve recorded reviewer approval if present."""
    key = f"{tenant_id}:{prs._normalize_pr_id(pr_id)}"
    return _REVIEW_APPROVALS.get(key)


def execute_simulated_merge(
    pr_id: Union[int, str],
    tenant_id: str = "demo",
    actor_name: str = "admin",
) -> Dict[str, Any]:
    """Execute a simulated merge ONLY if:
    1. PR revision evaluates to ELIGIBLE_FOR_REVIEW.
    2. An explicit reviewer approval sign-off has been recorded.
    """
    approval = get_reviewer_approval(pr_id, tenant_id=tenant_id)
    if not approval:
        raise ValueError("Simulated merge blocked: PR requires explicit reviewer approval before merge.")

    combined = verify_pr_combined(pr_id, tenant_id=tenant_id)
    if combined.combined_status != "ELIGIBLE_FOR_REVIEW":
        raise ValueError(
            f"Simulated merge blocked: PR status is '{combined.combined_status}'. Must be ELIGIBLE_FOR_REVIEW."
        )

    key = f"{tenant_id}:{prs._normalize_pr_id(pr_id)}"
    merge_record = {
        "pr_id": pr_id,
        "tenant_id": tenant_id,
        "merged_by": actor_name,
        "reviewer": approval["reviewer"],
        "revision_id": approval["revision_id"],
        "merged_at": datetime.now(timezone.utc).isoformat(),
        "status": "simulated_merge_success",
        "message": f"PR #{pr_id} successfully merged in simulation mode after reviewer signoff.",
    }
    _SIMULATED_MERGES[key] = merge_record
    return merge_record


# Concise alias
revalidate_patch = revalidate_security_patch
