"""Unit and integration tests for Phase 5: Preserve and Extend PR 12 & PR 13 with reproducible 4-case fixtures."""
from __future__ import annotations

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.pr.prs import DEMO_PRS, get_pr, list_prs, pr_edges
from backend.app.pr.service import analyze_pr, heal_pr
from backend.app.security.fixtures import (
    get_all_four_cases,
    get_case_by_identifier,
    get_demo_case_1_rel_pass_sec_pass,
    get_demo_case_2_rel_pass_sec_fail,
    get_demo_case_3_rel_fail_sec_pass,
    get_demo_case_4_rel_fail_sec_fail,
    get_demo_case_5_checks_incomplete,
)
from backend.app.security.orchestrator import scan_pr_security
from backend.app.security.combined import verify_pr_combined
from backend.app.sim.reference_sim import BASE_EDGES

client = TestClient(app)


def test_pr_12_semantics_and_scoring_strictly_preserved():
    """Verify PR 12 maintains exact brief specifications:
    - Risky edge order->inventory
    - Baseline resilience score 84
    - PR resilience score 32 (regression)
    - Auto-Fix gate accepted and score recovers to 84
    """
    pr12 = get_pr(12)
    assert pr12 is not None
    assert pr12["title"] == "Refactor inventory client"
    assert pr12["author"] == "dev-a"
    assert pr12["target_edge"] == ("order", "inventory")
    assert pr12["pr_edge"]["timeout"] is None
    assert pr12["pr_edge"]["retries"] == 4
    assert pr12["pr_edge"]["breaker"] is False
    assert pr12["pr_edge"]["fallback"] is False

    # Reliability analysis
    rel12 = analyze_pr(12)
    assert rel12["score_base"] == 84
    assert rel12["score_pr"] == 32
    assert rel12["verdict"] == "regression"
    rules = [f["rule"] for f in rel12["findings"]]
    assert "R1_TIMEOUT" in rules
    assert "R2_RETRY_STORM" in rules
    assert "R3_NO_FALLBACK" in rules

    # Auto-Fix healing
    heal12 = heal_pr(12)
    assert heal12["gate"] == "accepted"
    assert heal12["score_before"] == 32
    assert heal12["score_after"] == 84


def test_pr_13_semantics_and_scoring_strictly_preserved():
    """Verify PR 13 maintains exact brief specifications:
    - Target edge None (no resilience change)
    - Baseline resilience score 84
    - PR resilience score 84 (pass)
    - Zero resilience findings
    """
    pr13 = get_pr(13)
    assert pr13 is not None
    assert pr13["title"] == "Update README and logging"
    assert pr13["author"] == "dev-b"
    assert pr13["target_edge"] is None

    # Reliability analysis
    rel13 = analyze_pr(13)
    assert rel13["score_base"] == 84
    assert rel13["score_pr"] == 84
    assert rel13["verdict"] == "pass"
    assert len(rel13["findings"]) == 0


def test_pr_12_and_pr_13_independent_security_analysis():
    """Verify PR 12 and PR 13 security results originate from actual scans without artificial fabrication."""
    # PR 12 security scan
    sec12 = scan_pr_security(12)
    assert sec12.is_clean is True
    assert sec12.policy.verdict == "PASS"
    assert sec12.policy.blocking_findings_count == 0
    assert len(sec12.findings) == 0

    # PR 13 security scan
    sec13 = scan_pr_security(13)
    assert sec13.is_clean is True
    assert sec13.policy.verdict == "PASS"
    assert sec13.policy.blocking_findings_count == 0
    assert len(sec13.findings) == 0

    # Combined matrix outcomes
    comb12 = verify_pr_combined(12)
    assert comb12.combined_status == "BLOCKED_RELIABILITY"
    assert comb12.eligible_for_review is False
    assert comb12.reliability.score == 32
    assert comb12.security.status == "PASS"

    comb13 = verify_pr_combined(13)
    assert comb13.combined_status == "ELIGIBLE_FOR_REVIEW"
    assert comb13.eligible_for_review is True
    assert comb13.automatic_merge_authorized is False
    assert comb13.reliability.score == 84
    assert comb13.security.status == "PASS"


def test_four_reproducible_demonstration_cases():
    """Verify all 4 canonical outcome fixtures + incomplete case."""
    cases = get_all_four_cases()
    assert len(cases) == 5

    # Case 1: Rel PASS + Sec PASS -> ELIGIBLE_FOR_REVIEW
    c1 = cases["case_1_rel_pass_sec_pass"]
    assert c1["expected_reliability"] == "PASS"
    assert c1["expected_security"] == "PASS"
    assert c1["expected_combined_status"] == "ELIGIBLE_FOR_REVIEW"
    assert c1["eligible_for_review"] is True
    assert c1["combined"]["automatic_merge_authorized"] is False

    # Case 2: Rel PASS + Sec FAIL -> BLOCKED_SECURITY
    c2 = cases["case_2_rel_pass_sec_fail"]
    assert c2["expected_reliability"] == "PASS"
    assert c2["expected_security"] == "FAIL"
    assert c2["expected_combined_status"] == "BLOCKED_SECURITY"
    assert c2["eligible_for_review"] is False
    assert c2["reliability"]["score_pr"] == 84
    assert c2["security"]["policy"]["verdict"] == "FAIL"
    assert any("POLICY_OVERRIDE_PREVENTION" in r for r in c2["combined"]["machine_readable_reasons"])

    # Case 3: Rel FAIL + Sec PASS -> BLOCKED_RELIABILITY
    c3 = cases["case_3_rel_fail_sec_pass"]
    assert c3["expected_reliability"] == "FAIL"
    assert c3["expected_security"] == "PASS"
    assert c3["expected_combined_status"] == "BLOCKED_RELIABILITY"
    assert c3["eligible_for_review"] is False
    assert c3["reliability"]["score_pr"] == 32
    assert c3["security"]["policy"]["verdict"] == "PASS"

    # Case 4: Rel FAIL + Sec FAIL -> BLOCKED_BOTH
    c4 = cases["case_4_rel_fail_sec_fail"]
    assert c4["expected_reliability"] == "FAIL"
    assert c4["expected_security"] == "FAIL"
    assert c4["expected_combined_status"] == "BLOCKED_BOTH"
    assert c4["eligible_for_review"] is False
    assert c4["reliability"]["score_pr"] == 32
    assert c4["security"]["policy"]["verdict"] == "FAIL"
    assert any("DUAL_GATE_FAILURE" in r for r in c4["combined"]["machine_readable_reasons"])

    # Case 5: INCOMPLETE checks -> BLOCKED_CHECKS_INCOMPLETE
    c5 = cases["case_5_checks_incomplete"]
    assert c5["expected_reliability"] == "INCOMPLETE"
    assert c5["expected_security"] == "INCOMPLETE"
    assert c5["expected_combined_status"] == "BLOCKED_CHECKS_INCOMPLETE"
    assert c5["eligible_for_review"] is False


def test_demo_cases_retrieval_by_alias():
    """Verify get_case_by_identifier handles numeric, PR, and outcome aliases."""
    assert get_case_by_identifier("13")["case_id"] == "case_1_rel_pass_sec_pass"
    assert get_case_by_identifier("case_1_rel_pass_sec_pass")["pr_id"] == 13
    assert get_case_by_identifier("21")["case_id"] == "case_2_rel_pass_sec_fail"
    assert get_case_by_identifier("pass_fail")["case_id"] == "case_2_rel_pass_sec_fail"
    assert get_case_by_identifier("12")["case_id"] == "case_3_rel_fail_sec_pass"
    assert get_case_by_identifier("fail_pass")["case_id"] == "case_3_rel_fail_sec_pass"
    assert get_case_by_identifier("22")["case_id"] == "case_4_rel_fail_sec_fail"
    assert get_case_by_identifier("fail_fail")["case_id"] == "case_4_rel_fail_sec_fail"
    assert get_case_by_identifier("incomplete")["case_id"] == "case_5_checks_incomplete"
    assert get_case_by_identifier("non_existent") is None


def test_demo_cases_api_endpoints():
    """Verify HTTP GET /api/pr/demo-cases/all and /api/pr/demo-cases/{id}."""
    res_all = client.get("/api/pr-demo-cases")
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert len(data_all) == 5
    assert "case_1_rel_pass_sec_pass" in data_all
    assert "case_2_rel_pass_sec_fail" in data_all

    res_case2 = client.get("/api/pr/demo-cases/case_2_rel_pass_sec_fail")
    assert res_case2.status_code == 200
    data_c2 = res_case2.json()
    assert data_c2["expected_combined_status"] == "BLOCKED_SECURITY"
    assert data_c2["combined"]["combined_status"] == "BLOCKED_SECURITY"

    res_404 = client.get("/api/pr/demo-cases/unknown_case")
    assert res_404.status_code == 404


def test_precomputed_fixture_files_exist_on_disk():
    """Verify all precomputed fixtures are written and valid JSON."""
    fixtures_dir = Path(__file__).resolve().parents[3] / "fixtures"
    expected_files = [
        "pr.12.security.json",
        "pr.12.combined.json",
        "pr.13.security.json",
        "pr.13.combined.json",
        "security/case1_rel_pass_sec_pass.json",
        "security/case2_rel_pass_sec_fail.json",
        "security/case3_rel_fail_sec_pass.json",
        "security/case4_rel_fail_sec_fail.json",
        "security/case5_checks_incomplete.json",
    ]
    for rel in expected_files:
        f = fixtures_dir / rel
        assert f.exists(), f"Missing fixture file: {f}"
        data = json.loads(f.read_text(encoding="utf-8"))
        assert isinstance(data, dict)
