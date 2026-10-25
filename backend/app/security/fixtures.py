"""Reproducible Demonstration Fixtures for the 4 Combined Reliability & Security Outcomes (Phase 5).

Provides deterministic fixture configurations and generators for all four decision matrix quadrants:
  Case 1: Reliability PASS + Security PASS -> ELIGIBLE_FOR_REVIEW (Represented by PR 13)
  Case 2: Reliability PASS + Security FAIL -> BLOCKED_SECURITY (Represented by PR 21)
  Case 3: Reliability FAIL + Security PASS -> BLOCKED_RELIABILITY (Represented by PR 12)
  Case 4: Reliability FAIL + Security FAIL -> BLOCKED_BOTH (Represented by PR 22)
  Case 5: Required checks INCOMPLETE -> BLOCKED_CHECKS_INCOMPLETE (Pipeline failure demo)

Guarantees:
  - PR 12 and PR 13 semantics, diffs, and resilience scores (32 and 84) are strictly preserved.
  - Security scanning runs independently and produces genuine findings.
  - No synthetic secrets that could trigger external push protection (all use safe test tokens).
  - Pre-computed JSON fixtures can be exported for frontend and disconnected CI environments.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .combined import (
    CombinedVerificationResult,
    ReliabilitySummary,
    SecuritySummary,
    evaluate_combined_matrix,
    verify_pr_combined,
)
from .models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    ScannerExecutionMetadata,
    SecurityScanReport,
)
from .orchestrator import scan_pr_security
from ..pr.service import analyze_pr


def get_demo_case_1_rel_pass_sec_pass() -> Dict[str, Any]:
    """Case 1: Reliability PASS, Security PASS -> ELIGIBLE_FOR_REVIEW.
    Canonical representative: PR 13 ("Update README and logging").
    """
    rel = analyze_pr(13)
    sec = scan_pr_security(13)
    combined = verify_pr_combined(13, reliability_report=rel, security_report=sec)
    return {
        "case_id": "case_1_rel_pass_sec_pass",
        "name": "Case 1: Clean Reliability & Clean Security",
        "description": "README update without edge modifications. Reliability passes with score 84/84. Security scan passes cleanly with 0 flaws.",
        "pr_id": 13,
        "title": "Update README and logging",
        "author": "dev-b",
        "project_id": "checkout",
        "diff": rel.get("diff", "") if rel else "",
        "expected_reliability": "PASS",
        "expected_security": "PASS",
        "expected_combined_status": "ELIGIBLE_FOR_REVIEW",
        "eligible_for_review": True,
        "reliability": rel,
        "security": sec.model_dump(),
        "combined": combined.model_dump(),
    }


def get_demo_case_2_rel_pass_sec_fail() -> Dict[str, Any]:
    """Case 2: Reliability PASS, Security FAIL -> BLOCKED_SECURITY.
    Canonical representative: PR 21 ("Add payment webhook handler with exposed credential").
    Demonstrates that high resilience (84/84) CANNOT override security policy violations.
    """
    rel = analyze_pr(21)
    sec = scan_pr_security(21)
    combined = verify_pr_combined(21, reliability_report=rel, security_report=sec)
    return {
        "case_id": "case_2_rel_pass_sec_fail",
        "name": "Case 2: Clean Reliability with Security Vulnerability",
        "description": "Safe edge configuration maintaining baseline resilience (score 84), but introduces an exposed API credential in webhook handler diff.",
        "pr_id": 21,
        "title": "Add payment gateway webhook handler",
        "author": "dev-security",
        "project_id": "checkout",
        "diff": rel.get("diff", "") if rel else "",
        "expected_reliability": "PASS",
        "expected_security": "FAIL",
        "expected_combined_status": "BLOCKED_SECURITY",
        "eligible_for_review": False,
        "reliability": rel,
        "security": sec.model_dump(),
        "combined": combined.model_dump(),
    }


def get_demo_case_3_rel_fail_sec_pass() -> Dict[str, Any]:
    """Case 3: Reliability FAIL, Security PASS -> BLOCKED_RELIABILITY.
    Canonical representative: PR 12 ("Refactor inventory client").
    Risky resilience configuration (score 32 vs 84) with 0 security flaws.
    """
    rel = analyze_pr(12)
    sec = scan_pr_security(12)
    combined = verify_pr_combined(12, reliability_report=rel, security_report=sec)
    return {
        "case_id": "case_3_rel_fail_sec_pass",
        "name": "Case 3: Reliability Regression with Clean Security",
        "description": "Removes timeouts and circuit breaker on order->inventory edge causing severe resilience drop to 32/100. Security scan clean.",
        "pr_id": 12,
        "title": "Refactor inventory client",
        "author": "dev-a",
        "project_id": "checkout",
        "diff": rel.get("diff", "") if rel else "",
        "expected_reliability": "FAIL",
        "expected_security": "PASS",
        "expected_combined_status": "BLOCKED_RELIABILITY",
        "eligible_for_review": False,
        "reliability": rel,
        "security": sec.model_dump(),
        "combined": combined.model_dump(),
    }


def get_demo_case_4_rel_fail_sec_fail() -> Dict[str, Any]:
    """Case 4: Reliability FAIL, Security FAIL -> BLOCKED_BOTH.
    Canonical representative: PR 22 ("Unbounded retries with embedded auth token").
    Simultaneously regresses resilience (score 32) and exposes credentials.
    """
    rel = analyze_pr(22)
    sec = scan_pr_security(22)
    combined = verify_pr_combined(22, reliability_report=rel, security_report=sec)
    return {
        "case_id": "case_4_rel_fail_sec_fail",
        "name": "Case 4: Dual Reliability & Security Failure",
        "description": "Removes circuit breaker and adds retries: 4 on order->inventory edge AND introduces an unredacted auth token in configuration.",
        "pr_id": 22,
        "title": "Unbounded retry client with credentials",
        "author": "dev-security",
        "project_id": "checkout",
        "diff": rel.get("diff", "") if rel else "",
        "expected_reliability": "FAIL",
        "expected_security": "FAIL",
        "expected_combined_status": "BLOCKED_BOTH",
        "eligible_for_review": False,
        "reliability": rel,
        "security": sec.model_dump(),
        "combined": combined.model_dump(),
    }


def get_demo_case_5_checks_incomplete() -> Dict[str, Any]:
    """Case 5: Simulation or Scanner failure -> BLOCKED_CHECKS_INCOMPLETE.
    Demonstrates handling of crashed scanners or failed headless simulations.
    """
    rel_inc = {
        "id": 23,
        "score_base": 84,
        "score_pr": 0,
        "verdict": "error",
        "findings": [],
        "diff": "",
        "comment": "Simulation failed to execute: service container timed out.",
    }
    sec_meta = ScannerExecutionMetadata(
        scanner="bandit",
        status="failed",
        findings_count=0,
        error_message="Subprocess crashed with exit code 137 (OOM killed).",
    )
    pol = PolicyEvaluationResult(
        verdict="INCOMPLETE",
        passed=False,
        blocking_findings_count=0,
        summary="Required scanner 'bandit' failed to execute.",
        policy_version="1.1.0",
    )
    sec_inc = SecurityScanReport(
        scan_id="sec-demo-23-incomplete",
        pr_id=23,
        tenant_id="demo",
        commit_or_patch_hash="deadbeef",
        timestamp="2026-10-25T00:00:00Z",
        policy_version="1.1.0",
        scanners=[sec_meta],
        findings=[],
        policy=pol,
        is_clean=False,
        has_failures=True,
    )
    combined = verify_pr_combined(23, reliability_report=rel_inc, security_report=sec_inc)
    return {
        "case_id": "case_5_checks_incomplete",
        "name": "Case 5: Pipeline Checks Incomplete",
        "description": "Scanner crash or simulation execution error. Gate deterministically halts at BLOCKED_CHECKS_INCOMPLETE.",
        "pr_id": 23,
        "title": "Pipeline fault execution demo",
        "author": "dev-ops",
        "project_id": "checkout",
        "diff": "",
        "expected_reliability": "INCOMPLETE",
        "expected_security": "INCOMPLETE",
        "expected_combined_status": "BLOCKED_CHECKS_INCOMPLETE",
        "eligible_for_review": False,
        "reliability": rel_inc,
        "security": sec_inc.model_dump(),
        "combined": combined.model_dump(),
    }


_CASES_CACHE: Dict[str, Dict[str, Any]] = {}


def get_all_four_cases(refresh: bool = False) -> Dict[str, Dict[str, Any]]:
    """Return all 4 canonical outcome fixtures + incomplete case dictionary (memoized)."""
    global _CASES_CACHE
    if _CASES_CACHE and not refresh:
        return _CASES_CACHE

    _CASES_CACHE = {
        "case_1_rel_pass_sec_pass": get_demo_case_1_rel_pass_sec_pass(),
        "case_2_rel_pass_sec_fail": get_demo_case_2_rel_pass_sec_fail(),
        "case_3_rel_fail_sec_pass": get_demo_case_3_rel_fail_sec_pass(),
        "case_4_rel_fail_sec_fail": get_demo_case_4_rel_fail_sec_fail(),
        "case_5_checks_incomplete": get_demo_case_5_checks_incomplete(),
    }
    return _CASES_CACHE


def get_case_by_identifier(ident: str) -> Optional[Dict[str, Any]]:
    """Retrieve demo case by key or PR number."""
    s = str(ident).lower().strip()
    cases = get_all_four_cases()
    if s in cases:
        return cases[s]
    # Check aliases
    alias_map = {
        "1": "case_1_rel_pass_sec_pass",
        "13": "case_1_rel_pass_sec_pass",
        "pr13": "case_1_rel_pass_sec_pass",
        "pass_pass": "case_1_rel_pass_sec_pass",
        "2": "case_2_rel_pass_sec_fail",
        "21": "case_2_rel_pass_sec_fail",
        "pr21": "case_2_rel_pass_sec_fail",
        "pass_fail": "case_2_rel_pass_sec_fail",
        "3": "case_3_rel_fail_sec_pass",
        "12": "case_3_rel_fail_sec_pass",
        "pr12": "case_3_rel_fail_sec_pass",
        "fail_pass": "case_3_rel_fail_sec_pass",
        "4": "case_4_rel_fail_sec_fail",
        "22": "case_4_rel_fail_sec_fail",
        "pr22": "case_4_rel_fail_sec_fail",
        "fail_fail": "case_4_rel_fail_sec_fail",
        "5": "case_5_checks_incomplete",
        "23": "case_5_checks_incomplete",
        "incomplete": "case_5_checks_incomplete",
    }
    if s in alias_map:
        return cases[alias_map[s]]
    return None


def export_fixtures_to_disk(
    backend_fixtures_dir: Optional[Path] = None,
    frontend_fixtures_dir: Optional[Path] = None,
) -> List[str]:
    """Export pre-computed JSON files for PR 12, PR 13, and the 4 demonstration cases."""
    if backend_fixtures_dir is None:
        backend_fixtures_dir = Path(__file__).resolve().parents[3] / "fixtures"
    if frontend_fixtures_dir is None:
        frontend_fixtures_dir = Path(__file__).resolve().parents[3] / "frontend" / "public" / "fixtures"

    dirs = [backend_fixtures_dir]
    if frontend_fixtures_dir.exists():
        dirs.append(frontend_fixtures_dir)

    written: List[str] = []
    cases = get_all_four_cases()

    # Pre-computed PR 12 and PR 13 files
    pr12_case = cases["case_3_rel_fail_sec_pass"]
    pr13_case = cases["case_1_rel_pass_sec_pass"]

    targets = {
        "pr.12.security.json": pr12_case["security"],
        "pr.12.combined.json": pr12_case["combined"],
        "pr.13.security.json": pr13_case["security"],
        "pr.13.combined.json": pr13_case["combined"],
        "security/case1_rel_pass_sec_pass.json": cases["case_1_rel_pass_sec_pass"],
        "security/case2_rel_pass_sec_fail.json": cases["case_2_rel_pass_sec_fail"],
        "security/case3_rel_fail_sec_pass.json": cases["case_3_rel_fail_sec_pass"],
        "security/case4_rel_fail_sec_fail.json": cases["case_4_rel_fail_sec_fail"],
        "security/case5_checks_incomplete.json": cases["case_5_checks_incomplete"],
    }

    for base_dir in dirs:
        sec_dir = base_dir / "security"
        sec_dir.mkdir(parents=True, exist_ok=True)
        for rel_path, data in targets.items():
            fpath = base_dir / rel_path
            fpath.parent.mkdir(parents=True, exist_ok=True)
            fpath.write_text(json.dumps(data, indent=2), encoding="utf-8")
            written.append(str(fpath))

    return written
