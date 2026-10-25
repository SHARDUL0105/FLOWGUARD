"""Phase 12: Comprehensive Automated Test Suite covering all 12 specified scenarios.

Ownership Boundary Compliance:
- Strictly NO authentication or authorization implementation or tests.
- Strictly NO modification of teammate-owned components (Sneha & Abhiraj).
- Strictly preserves existing resilience scoring formula and simulation behavior.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.pr.prs import get_pr
from backend.app.pr.service import analyze_pr, heal_pr
from backend.app.security.combined import (
    CombinedStatus,
    CombinedVerificationResult,
    verify_pr_combined,
)
from backend.app.security.fixtures import (
    get_all_four_cases,
    get_demo_case_1_rel_pass_sec_pass,
    get_demo_case_2_rel_pass_sec_fail,
    get_demo_case_3_rel_fail_sec_pass,
    get_demo_case_4_rel_fail_sec_fail,
    get_demo_case_5_checks_incomplete,
)
from backend.app.security.models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    ScannerExecutionMetadata,
    SecurityPolicyConfig,
)
from backend.app.security.policy import (
    evaluate_security_policy,
)
from backend.app.security.redactor import mask_secret, redact_text
from backend.app.security.orchestrator import (
    scan_pr_security,
)
from backend.app.security.revalidation import (
    revalidate_security_patch,
    validate_autofix_workflow,
)
from backend.app.security.subprocess_runner import run_command_safely
from backend.app.security.secret_scanner import scan_diff_for_secrets
from backend.app.intel.scoring import resilience_score
from backend.app.sim.reference_sim import BASE_EDGES, run, window

client = TestClient(app)


# ==============================================================================
# Scenario 1: Resilience PASS + Security PASS -> ELIGIBLE_FOR_REVIEW
# ==============================================================================
def test_scenario_1_resilience_pass_security_pass():
    """Scenario 1:
    Resilience PASS (>= 70) and Security PASS (clean findings).
    Combined Result: ELIGIBLE_FOR_REVIEW.
    Reviewer sign-off is mandatory; automatic merge is NOT authorized.
    """
    case1 = get_demo_case_1_rel_pass_sec_pass()
    assert case1["expected_combined_status"] == "ELIGIBLE_FOR_REVIEW"
    assert case1["reliability"]["verdict"] == "pass"
    assert case1["reliability"]["score_pr"] >= 70
    assert case1["security"]["policy"]["verdict"] == "PASS"

    comb13 = verify_pr_combined(13)
    assert comb13.combined_status == "ELIGIBLE_FOR_REVIEW"
    assert comb13.eligible_for_review is True
    assert comb13.automatic_merge_authorized is False
    assert comb13.review_signoff_required is True
    assert any("REVIEW_REQUIRED" in r for r in comb13.machine_readable_reasons)
    assert any("SECURITY_PASS" in r for r in comb13.machine_readable_reasons)


# ==============================================================================
# Scenario 2: Resilience PASS + Security FAIL -> BLOCKED_SECURITY
# ==============================================================================
def test_scenario_2_resilience_pass_security_fail():
    """Scenario 2:
    Resilience PASS (score 84) but Security FAIL (e.g. exposed secret).
    Combined Result: BLOCKED_SECURITY.
    Score Override Prevention: high resilience score NEVER overrides security failure.
    """
    case2 = get_demo_case_2_rel_pass_sec_fail()
    assert case2["expected_combined_status"] == "BLOCKED_SECURITY"
    assert case2["reliability"]["verdict"] == "pass"
    assert case2["reliability"]["score_pr"] == 84
    assert case2["security"]["policy"]["verdict"] == "FAIL"

    comb21 = verify_pr_combined(21)
    assert comb21.combined_status == "BLOCKED_SECURITY"
    assert comb21.eligible_for_review is False
    assert comb21.automatic_merge_authorized is False
    assert comb21.review_signoff_required is True

    # Confirm machine-readable override prevention
    assert any("POLICY_OVERRIDE_PREVENTION" in reason for reason in comb21.machine_readable_reasons)
    assert any("SECURITY_FAIL" in reason for reason in comb21.machine_readable_reasons)


# ==============================================================================
# Scenario 3: Resilience FAIL + Security PASS -> BLOCKED_RELIABILITY
# ==============================================================================
def test_scenario_3_resilience_fail_security_pass():
    """Scenario 3:
    Resilience FAIL (score 32, regression) and Security PASS.
    Combined Result: BLOCKED_RELIABILITY.
    """
    case3 = get_demo_case_3_rel_fail_sec_pass()
    assert case3["expected_combined_status"] == "BLOCKED_RELIABILITY"
    assert case3["reliability"]["verdict"] == "regression"
    assert case3["reliability"]["score_pr"] == 32
    assert case3["security"]["policy"]["verdict"] == "PASS"

    comb12 = verify_pr_combined(12)
    assert comb12.combined_status == "BLOCKED_RELIABILITY"
    assert comb12.eligible_for_review is False
    assert comb12.automatic_merge_authorized is False
    assert any("RELIABILITY_FAIL" in reason for reason in comb12.machine_readable_reasons)
    assert any("SECURITY_PASS" in reason for reason in comb12.machine_readable_reasons)


# ==============================================================================
# Scenario 4: Resilience FAIL + Security FAIL -> BLOCKED_BOTH
# ==============================================================================
def test_scenario_4_resilience_fail_security_fail():
    """Scenario 4:
    Resilience FAIL (score 32) and Security FAIL (exposed credential).
    Combined Result: BLOCKED_BOTH.
    """
    case4 = get_demo_case_4_rel_fail_sec_fail()
    assert case4["expected_combined_status"] == "BLOCKED_BOTH"
    assert case4["reliability"]["verdict"] == "regression"
    assert case4["reliability"]["score_pr"] == 32
    assert case4["security"]["policy"]["verdict"] == "FAIL"

    comb22 = verify_pr_combined(22)
    assert comb22.combined_status == "BLOCKED_BOTH"
    assert comb22.eligible_for_review is False
    assert comb22.automatic_merge_authorized is False
    assert any("DUAL_GATE_FAILURE" in reason for reason in comb22.machine_readable_reasons)
    assert any("SECURITY_FAIL" in reason for reason in comb22.machine_readable_reasons)
    assert any("RELIABILITY_FAIL" in reason for reason in comb22.machine_readable_reasons)


# ==============================================================================
# Scenario 5: Scanner Execution Returns INCOMPLETE
# ==============================================================================
def test_scenario_5_scanner_execution_incomplete():
    """Scenario 5:
    When a mandatory scanner execution times out, errors, or fails to complete.
    Combined Result: BLOCKED_CHECKS_INCOMPLETE.
    Must NEVER be classified as passing.
    """
    case5 = get_demo_case_5_checks_incomplete()
    assert case5["expected_combined_status"] == "BLOCKED_CHECKS_INCOMPLETE"
    assert case5["security"]["policy"]["verdict"] == "INCOMPLETE"

    comb23 = verify_pr_combined(23)
    assert comb23.combined_status == "BLOCKED_CHECKS_INCOMPLETE"
    assert comb23.eligible_for_review is False
    assert comb23.automatic_merge_authorized is False
    assert any("incomplete" in reason.lower() for reason in comb23.machine_readable_reasons)


# ==============================================================================
# Scenario 6: Scanner Exceptions and Timeouts
# ==============================================================================
def test_scenario_6_scanner_exceptions_and_timeouts():
    """Scenario 6:
    Safe subprocess runner handles timeouts and non-zero commands safely:
    - Bounded execution time with timeout.
    - Captures stdout/stderr safely without shell interpolation.
    - Status correctly flagged as timed_out or non-zero return code.
    - Backend does not crash and does not interpret failure as clean pass.
    """
    # 1. Timeout handling
    res_timeout = run_command_safely(
        ["powershell", "-Command", "Start-Sleep -Seconds 5"],
        timeout=0.5,
    )
    assert res_timeout.timed_out is True
    assert res_timeout.returncode == -1
    assert "timed out" in res_timeout.error_message.lower()

    # 2. Non-existent command / execution error
    res_error = run_command_safely(
        ["non_existent_binary_tool_xyz123"],
        timeout=1.0,
    )
    assert res_error.returncode == -1
    assert len(res_error.error_message) > 0

    # 3. Policy evaluation treats failed scanner execution as INCOMPLETE
    scanners = [
        ScannerExecutionMetadata(
            scanner="bandit",
            status="failed",
            duration_ms=50.0,
            error_message="Subprocess execution failed",
        )
    ]
    policy_res = evaluate_security_policy(findings=[], scanners=scanners)
    assert policy_res.verdict == "INCOMPLETE"
    assert any("bandit" in r for r in policy_res.blocking_reasons)


# ==============================================================================
# Scenario 7: Credential Redaction
# ==============================================================================
def test_scenario_7_credential_redaction():
    """Scenario 7:
    Verify that credential redaction masks secrets to [REDACTED].
    Ensures no raw API keys or tokens are leaked in findings or API responses.
    """
    # Build synthetic secret tokens safely via string concatenation to protect git history
    sample_key = ("sk_" + "live_") + "abcdef1234567890abcdef1234"
    masked = mask_secret(sample_key, prefix_len=7, suffix_len=4)
    assert masked.startswith("sk_live")
    assert "*" in masked
    assert "abcdef1234567890" not in masked

    # Diff containing secret
    raw_diff = (
        "diff --git a/config.py b/config.py\n"
        "@@ -1,2 +1,3 @@\n"
        "+STRIPE_KEY = \"" + ("sk_" + "live_") + "abcdef1234567890abcdef1234\"\n"
        "+AWS_SECRET = \"secret_aws_token_xyz987654321\"\n"
    )
    findings, meta = scan_diff_for_secrets(raw_diff)
    assert len(findings) >= 1

    for finding in findings:
        # Title and explanation must NEVER contain raw secret
        assert sample_key not in finding.title
        assert sample_key not in finding.explanation
        assert "secret_aws_token_xyz987654321" not in finding.explanation
        assert sample_key not in (finding.raw_snippet or "")


# ==============================================================================
# Scenario 8: Auto-Fix Triggers Security Revalidation
# ==============================================================================
def test_scenario_8_autofix_triggers_security_revalidation():
    """Scenario 8:
    Verify Auto-Fix runs reliability healing AND executes security revalidation on the patched snapshot.
    PR 12:
    - Original score 32 -> healed score 84.
    - Security scan runs on patched snapshot (clean PASS).
    - Dual gates accepted.
    """
    heal_res = heal_pr(12)
    assert heal_res is not None
    assert heal_res["id"] == 12
    assert heal_res["score_before"] == 32
    assert heal_res["score_after"] == 84
    assert heal_res["gate"] == "accepted"

    # Security revalidation output present and verified
    sec_rev = heal_res.get("security_revalidation")
    assert sec_rev is not None
    assert sec_rev["passed"] is True
    assert sec_rev["policy_verdict"] == "PASS"
    assert sec_rev["blocking_introduced_count"] == 0
    assert sec_rev["blocking_remaining_count"] == 0

    # Reviewer signoff requirement enforced
    assert heal_res["review_signoff_required"] is True
    assert heal_res["automatic_merge_authorized"] is False
    assert heal_res["post_fix"]["combined_status"] == "ELIGIBLE_FOR_REVIEW"


# ==============================================================================
# Scenario 9: Post-Fix Scan Still Detects an Issue
# ==============================================================================
def test_scenario_9_postfix_scan_still_detects_issue():
    """Scenario 9:
    If an Auto-Fix patch heals resilience but leaves an existing security issue unresolved,
    or introduces a new one, the patch is REJECTED.
    """
    secret_val = ("sk_" + "live_") + "99887766554433221100aabb"
    original_diff = (
        "diff --git a/backend/app/sim/reference_sim.py b/backend/app/sim/reference_sim.py\n"
        "--- a/backend/app/sim/reference_sim.py\n"
        "+++ b/backend/app/sim/reference_sim.py\n"
        "+# RISKY CHANGE\n"
        "+STRIPE_KEY = \"" + secret_val + "\"\n"
        "+EDGES = {\n"
        "+    ('order', 'inventory'): Edge(timeout=None, retries=4, breaker=False, fallback=False),\n"
        "+}\n"
    )
    # Proposed patch only heals the edge, leaving the secret intact
    patched_diff = (
        "diff --git a/backend/app/sim/reference_sim.py b/backend/app/sim/reference_sim.py\n"
        "--- a/backend/app/sim/reference_sim.py\n"
        "+++ b/backend/app/sim/reference_sim.py\n"
        "+STRIPE_KEY = \"" + secret_val + "\"\n"
        "+    ('order', 'inventory'): Edge(timeout=700, retries=1, breaker=True, fallback=True),\n"
    )

    orig_report = scan_pr_security(pr_id=992, tenant_id="demo", diff_override=original_diff)
    passed, new_report, reason = revalidate_security_patch(orig_report, patched_diff, pr_id=992)

    # Patch must be rejected by security gate
    assert passed is False
    assert new_report.policy.verdict == "FAIL"
    assert "blocking" in reason.lower() or "unresolved" in reason.lower()


# ==============================================================================
# Scenario 10: Post-Fix Scan No Longer Detects the Relevant Issue
# ==============================================================================
def test_scenario_10_postfix_scan_no_longer_detects_issue():
    """Scenario 10:
    When a patch resolves the security vulnerability (e.g. credential removed),
    the post-fix scan confirms the issue is resolved and passes the security gate.
    """
    secret_val = ("sk_" + "live_") + "resolvable_token_12345678"
    original_diff = (
        "diff --git a/config.py b/config.py\n"
        "+API_KEY = \"" + secret_val + "\"\n"
    )
    # Patch completely removes the hardcoded credential
    patched_diff = (
        "diff --git a/config.py b/config.py\n"
        "+API_KEY = os.environ.get('API_KEY')\n"
    )

    orig_report = scan_pr_security(pr_id=993, tenant_id="demo", diff_override=original_diff)
    passed, new_report, reason = revalidate_security_patch(orig_report, patched_diff, pr_id=993)

    assert passed is True
    assert new_report.policy.verdict == "PASS"
    assert "patch security verified" in reason.lower() or "policy pass" in reason.lower()


# ==============================================================================
# Scenario 11: Existing PR 12 and PR 13 Behavior Remains Unchanged
# ==============================================================================
def test_scenario_11_existing_pr12_and_pr13_behavior_unchanged():
    """Scenario 11:
    Verify PR 12 and PR 13 exact semantics and numbers:
    - PR 12: base score 84, PR score 32, healed score 84.
    - PR 13: base score 84, PR score 84 (clean pass).
    - Endpoints /api/pr/12/analyze, /api/pr/12/heal, /api/pr/13/analyze return valid backward-compatible payloads.
    """
    # 1. PR 12 analysis endpoint
    res12 = client.post("/api/pr/12/analyze")
    assert res12.status_code == 200
    data12 = res12.json()
    assert data12["id"] == 12
    assert data12["score_base"] == 84
    assert data12["score_pr"] == 32
    assert data12["verdict"] == "regression"

    # 2. PR 12 heal endpoint
    res12_heal = client.post("/api/pr/12/heal")
    assert res12_heal.status_code == 200
    heal_data = res12_heal.json()
    assert heal_data["id"] == 12
    assert heal_data["score_before"] == 32
    assert heal_data["score_after"] == 84
    assert heal_data["gate"] == "accepted"

    # 3. PR 13 analysis endpoint
    res13 = client.post("/api/pr/13/analyze")
    assert res13.status_code == 200
    data13 = res13.json()
    assert data13["id"] == 13
    assert data13["score_base"] == 84
    assert data13["score_pr"] == 84
    assert data13["verdict"] == "pass"


# ==============================================================================
# Scenario 12: Existing Resilience Scoring and Simulation Regressions
# ==============================================================================
def test_scenario_12_existing_resilience_scoring_and_simulation_regressions():
    """Scenario 12:
    Verify that core simulation engine and resilience formula are 100% regression-free:
    - Baseline resilience score on BASE_EDGES is approximately 84.
    - Simulating service_down scenario produces expected degradation without exceptions.
    """
    # 1. Baseline resilience score formula
    base_score = resilience_score(BASE_EDGES)
    assert base_score == pytest.approx(84, abs=2)

    # 2. Simulation engine failure injection
    p95, error_rate = window(run(BASE_EDGES, "service_down", severity=1.0))
    assert error_rate > 0.0 or p95 > 0.0
