"""Security scanner orchestrator.
Coordinates static SAST, secret, and dependency scanners; normalizes results;
applies policy evaluation; redacts secrets; and stores audit reports.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from ..pr import prs
from .models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    ScannerExecutionMetadata,
    SecurityPolicyConfig,
    SecurityScanReport,
)
from .policy import evaluate_security_policy
from .redactor import redact_data, redact_text
from .scanners.bandit_scanner import run_bandit_scan
from .scanners.external_scanners import run_gitleaks_scan, run_semgrep_scan
from .scanners.npm_audit_scanner import run_npm_audit_scan
from .scanners.pip_audit_scanner import run_pip_audit_scan
from .secret_scanner import scan_diff_for_secrets
from .storage import save_security_report


def compute_patch_hash(diff_text: str) -> str:
    """Compute SHA-256 hash of the diff or snapshot to uniquely identify commit/patch state."""
    raw = (diff_text or "").encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def scan_pr_security(
    pr_id: Any,
    tenant_id: str = "demo",
    diff_override: Optional[str] = None,
    repo_dir: Optional[str] = None,
    include_dependency_scans: bool = False,
    blocking_severities: Optional[Set[str]] = None,
    policy_config: Optional[SecurityPolicyConfig] = None,
    baseline_findings: Optional[List[NormalizedFinding]] = None,
    security_tests_passed: Optional[bool] = None,
    patch_validation_passed: Optional[bool] = None,
) -> SecurityScanReport:
    """Execute complete security scan orchestration for a pull request.

    Args:
        pr_id: Pull request identifier (e.g. 12, 13, or user PR id).
        tenant_id: Organization tenant ID.
        diff_override: Optional diff string overriding stored PR diff (e.g. for revalidation).
        repo_dir: Optional path to repo or snapshot root directory.
        include_dependency_scans: Whether to run pip-audit and npm-audit.
        blocking_severities: Set of severities that trigger policy failure (default: critical, high).

    Returns:
        SecurityScanReport matching the normalized FLOWGUARD schema.
    """
    now_utc = datetime.now(timezone.utc).isoformat()
    norm_id = prs._normalize_pr_id(pr_id)

    # 1. Resolve PR and diff content
    pr_data = prs.get_pr(pr_id, tenant_id=tenant_id)
    if diff_override is not None:
        diff_text = diff_override
    elif pr_data and pr_data.get("diff"):
        diff_text = pr_data["diff"]
    else:
        diff_text = ""

    patch_hash = compute_patch_hash(diff_text)
    scan_id = f"sec-{norm_id}-{patch_hash[:8]}-{int(datetime.now(timezone.utc).timestamp())}"

    all_findings: List[NormalizedFinding] = []
    scanners_meta: List[ScannerExecutionMetadata] = []

    # 2. Scanner 1: Native Static Secret Scanner (always runs on diff)
    secret_findings, secret_meta = scan_diff_for_secrets(diff_text)
    all_findings.extend(secret_findings)
    scanners_meta.append(secret_meta)

    # 3. Scanner 2: Python SAST Scanner (Bandit)
    # Target either repo_dir, or the backend/app/pr directory as a controlled snapshot
    target_sast_path = None
    if repo_dir and os.path.exists(repo_dir):
        target_sast_path = repo_dir
    else:
        # Scan controlled backend PR module
        default_pr_dir = Path(__file__).resolve().parents[1] / "pr"
        if default_pr_dir.exists():
            target_sast_path = str(default_pr_dir)

    if target_sast_path:
        bandit_findings, bandit_meta = run_bandit_scan(target_sast_path)
        # In PR mode, filter Bandit findings to files touched in diff if diff specifies files
        if diff_text:
            touched_files = set()
            for line in diff_text.splitlines():
                if line.startswith("+++ b/"):
                    touched_files.add(line[6:].strip())
                elif line.startswith("--- a/"):
                    touched_files.add(line[6:].strip())
            if touched_files:
                bandit_findings = [f for f in bandit_findings if any(tf in (f.file_path or "") for tf in touched_files)]
                bandit_meta.findings_count = len(bandit_findings)

        all_findings.extend(bandit_findings)
        scanners_meta.append(bandit_meta)
    else:
        scanners_meta.append(
            ScannerExecutionMetadata(
                scanner="bandit",
                status="skipped",
                findings_count=0,
                error_message="No target directory available for SAST scan.",
            )
        )

    # 4. Scanner 3 & 4: Dependency Scanners (optional / on-demand)
    if include_dependency_scans:
        repo_root = Path(__file__).resolve().parents[3]
        reqs = repo_root / "backend" / "requirements.txt"
        pip_findings, pip_meta = run_pip_audit_scan(str(reqs) if reqs.exists() else None)
        all_findings.extend(pip_findings)
        scanners_meta.append(pip_meta)

        front_dir = repo_root / "frontend"
        npm_findings, npm_meta = run_npm_audit_scan(str(front_dir))
        all_findings.extend(npm_findings)
        scanners_meta.append(npm_meta)

    # 5. Scanner 5 & 6: Check external tooling (Gitleaks, Semgrep)
    # Transparently report tool availability without fabricating fake runs
    target_ext = repo_dir or str(Path(__file__).resolve().parents[1] / "pr")
    _, gitleaks_meta = run_gitleaks_scan(target_ext)
    scanners_meta.append(gitleaks_meta)

    _, semgrep_meta = run_semgrep_scan(target_ext)
    scanners_meta.append(semgrep_meta)

    # 6. Apply Security Policy Evaluation
    policy_res = evaluate_security_policy(
        findings=all_findings,
        scanners=scanners_meta,
        blocking_severities=blocking_severities,
        config=policy_config,
        security_tests_passed=security_tests_passed,
        patch_validation_passed=patch_validation_passed,
        baseline_findings=baseline_findings,
    )

    # 7. Redact any sensitive content across findings and snippets
    sanitized_findings: List[NormalizedFinding] = []
    for f in all_findings:
        f_dict = f.model_dump()
        redacted_dict = redact_data(f_dict)
        sanitized_findings.append(NormalizedFinding(**redacted_dict))

    has_failures = any(s.status == "failed" for s in scanners_meta)
    is_clean = len(sanitized_findings) == 0 and not has_failures

    report = SecurityScanReport(
        scan_id=scan_id,
        pr_id=pr_data["id"] if pr_data else pr_id,
        tenant_id=tenant_id,
        commit_or_patch_hash=patch_hash,
        timestamp=now_utc,
        policy_version=policy_res.policy_version,
        scanners=scanners_meta,
        findings=sanitized_findings,
        policy=policy_res,
        is_clean=is_clean,
        has_failures=has_failures,
    )

    # 8. Persist report to storage
    save_security_report(report)
    return report
