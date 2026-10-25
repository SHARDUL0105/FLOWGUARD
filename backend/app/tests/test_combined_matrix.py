"""Unit and integration tests for the Combined Reliability and Security PR Verification Matrix (Phase 4)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.pr.service import analyze_pr
from backend.app.security.combined import (
    CombinedVerificationResult,
    evaluate_combined_matrix,
    extract_reliability_status,
    extract_security_status,
    verify_pr_combined,
)
from backend.app.security.models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    ScannerExecutionMetadata,
    SecurityScanReport,
)
from backend.app.security.orchestrator import scan_pr_security

client = TestClient(app)


def _mock_reliability_report(verdict: str = "pass", score_pr: int = 84, score_base: int = 84) -> dict:
    return {
        "id": 13,
        "score_base": score_base,
        "score_pr": score_pr,
        "verdict": verdict,
        "per_scenario": [],
        "findings": [],
        "cascade_path": [],
        "diff": "",
        "comment": "",
    }


def _mock_security_report(verdict: str = "PASS", passed: bool = True, blocking_count: int = 0) -> SecurityScanReport:
    pol = PolicyEvaluationResult(
        verdict=verdict,
        passed=passed,
        blocking_findings_count=blocking_count,
        summary="Policy summary",
        policy_version="1.1.0",
    )
    return SecurityScanReport(
        scan_id="sec-mock-1",
        pr_id=13,
        tenant_id="demo",
        commit_or_patch_hash="mockhash",
        timestamp="2026-10-25T00:00:00Z",
        policy_version="1.1.0",
        scanners=[ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")],
        findings=[],
        policy=pol,
        is_clean=(blocking_count == 0 and passed),
        has_failures=(verdict == "INCOMPLETE"),
    )


def test_matrix_cell_1_rel_pass_sec_pass_eligible_for_review():
    """Reliability PASS + Security PASS -> ELIGIBLE_FOR_REVIEW."""
    rel = _mock_reliability_report(verdict="pass", score_pr=84, score_base=84)
    sec = _mock_security_report(verdict="PASS", passed=True, blocking_count=0)

    result = verify_pr_combined(
        pr_id=13,
        reliability_report=rel,
        security_report=sec,
    )

    assert result.combined_status == "ELIGIBLE_FOR_REVIEW"
    assert result.eligible_for_review is True
    assert result.automatic_merge_authorized is False  # Never automatic!
    assert result.review_signoff_required is True
    assert result.all_checks_completed is True
    assert any("RELIABILITY_PASS" in r for r in result.machine_readable_reasons)
    assert any("SECURITY_PASS" in r for r in result.machine_readable_reasons)


def test_matrix_cell_2_rel_pass_sec_fail_blocked_security():
    """Reliability PASS + Security FAIL -> BLOCKED_SECURITY. High score cannot cancel out security failure."""
    rel = _mock_reliability_report(verdict="pass", score_pr=95, score_base=84)
    sec = _mock_security_report(verdict="FAIL", passed=False, blocking_count=2)

    result = verify_pr_combined(
        pr_id=13,
        reliability_report=rel,
        security_report=sec,
    )

    assert result.combined_status == "BLOCKED_SECURITY"
    assert result.eligible_for_review is False
    assert result.automatic_merge_authorized is False
    # Resilience score remains purely 95, not averaged or canceled out
    assert result.reliability.score == 95
    assert any("POLICY_OVERRIDE_PREVENTION" in r for r in result.machine_readable_reasons)
    assert any("SECURITY_FAIL" in r for r in result.machine_readable_reasons)


def test_matrix_cell_3_rel_fail_sec_pass_blocked_reliability():
    """Reliability FAIL + Security PASS -> BLOCKED_RELIABILITY."""
    rel = _mock_reliability_report(verdict="regression", score_pr=32, score_base=84)
    sec = _mock_security_report(verdict="PASS", passed=True, blocking_count=0)

    result = verify_pr_combined(
        pr_id=12,
        reliability_report=rel,
        security_report=sec,
    )

    assert result.combined_status == "BLOCKED_RELIABILITY"
    assert result.eligible_for_review is False
    assert result.reliability.score == 32
    assert result.security.status == "PASS"
    assert any("RELIABILITY_FAIL" in r for r in result.machine_readable_reasons)
    assert any("SECURITY_PASS" in r for r in result.machine_readable_reasons)


def test_matrix_cell_4_rel_fail_sec_fail_blocked_both():
    """Reliability FAIL + Security FAIL -> BLOCKED_BOTH."""
    rel = _mock_reliability_report(verdict="regression", score_pr=32, score_base=84)
    sec = _mock_security_report(verdict="FAIL", passed=False, blocking_count=3)

    result = verify_pr_combined(
        pr_id=12,
        reliability_report=rel,
        security_report=sec,
    )

    assert result.combined_status == "BLOCKED_BOTH"
    assert result.eligible_for_review is False
    assert any("DUAL_GATE_FAILURE" in r for r in result.machine_readable_reasons)


def test_matrix_cell_5_incomplete_checks():
    """Incomplete reliability or security pipeline -> BLOCKED_CHECKS_INCOMPLETE."""
    # Reliability incomplete (e.g. simulation crash)
    res_rel_inc = verify_pr_combined(
        pr_id=12,
        reliability_report={"verdict": "error"},
        security_report=_mock_security_report(verdict="PASS", passed=True),
    )
    assert res_rel_inc.combined_status == "BLOCKED_CHECKS_INCOMPLETE"
    assert res_rel_inc.all_checks_completed is False
    assert res_rel_inc.eligible_for_review is False

    # Security incomplete (e.g. scanner failure)
    res_sec_inc = verify_pr_combined(
        pr_id=13,
        reliability_report=_mock_reliability_report(verdict="pass", score_pr=84),
        security_report=_mock_security_report(verdict="INCOMPLETE", passed=False),
    )
    assert res_sec_inc.combined_status == "BLOCKED_CHECKS_INCOMPLETE"
    assert res_sec_inc.all_checks_completed is False
    assert res_sec_inc.eligible_for_review is False


def test_pr_12_and_pr_13_end_to_end_evaluation():
    """Verify live PR 12 and PR 13 under the combined gate."""
    # PR 12 live evaluation: Reliability regressed to 32, Security clean -> BLOCKED_RELIABILITY
    pr12_combined = verify_pr_combined(12)
    assert pr12_combined.pr_id == 12
    assert pr12_combined.combined_status == "BLOCKED_RELIABILITY"
    assert pr12_combined.reliability.score == 32
    assert pr12_combined.security.status == "PASS"
    assert pr12_combined.eligible_for_review is False

    # PR 13 live evaluation: Reliability score 84, Security clean -> ELIGIBLE_FOR_REVIEW
    pr13_combined = verify_pr_combined(13)
    assert pr13_combined.pr_id == 13
    assert pr13_combined.combined_status == "ELIGIBLE_FOR_REVIEW"
    assert pr13_combined.reliability.score == 84
    assert pr13_combined.security.status == "PASS"
    assert pr13_combined.eligible_for_review is True
    assert pr13_combined.automatic_merge_authorized is False


def test_combined_api_endpoint():
    """Verify FastAPI GET and POST /api/pr/{id}/combined."""
    # GET /api/pr/13/combined
    res_get = client.get("/api/pr/13/combined", headers={"X-Tenant-ID": "demo"})
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert data_get["combined_status"] == "ELIGIBLE_FOR_REVIEW"
    assert data_get["eligible_for_review"] is True
    assert data_get["automatic_merge_authorized"] is False

    # POST /api/pr/12/combined
    res_post = client.post("/api/pr/12/combined", headers={"X-Tenant-ID": "demo"})
    assert res_post.status_code == 200
    data_post = res_post.json()
    assert data_post["combined_status"] == "BLOCKED_RELIABILITY"
    assert data_post["eligible_for_review"] is False
    assert data_post["reliability"]["score"] == 32
