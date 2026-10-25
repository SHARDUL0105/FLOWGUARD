"""Unit and integration tests for the FLOWGUARD Deterministic Security Policy Evaluator (Phase 3)."""
from __future__ import annotations

import pytest

from backend.app.intel.runtime.scoring import resilience_score
from backend.app.pr.prs import pr_edges
from backend.app.security.models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    ScannerExecutionMetadata,
    SecurityPolicyConfig,
)
from backend.app.security.policy import DeterministicPolicyEvaluator, evaluate_security_policy
from backend.app.sim.topology import BASE_EDGES


def _make_finding(
    fid: str = "f1",
    rule_id: str = "R1",
    category: str = "sast",
    severity: str = "high",
    is_new: bool = True,
    title: str = "Sample vulnerability",
) -> NormalizedFinding:
    return NormalizedFinding(
        id=fid,
        scanner="flowguard-secrets",
        rule_id=rule_id,
        category=category,  # type: ignore[arg-type]
        severity=severity,  # type: ignore[arg-type]
        title=title,
        explanation="Detailed description of vulnerability",
        remediation="Remediation guidance",
        confidence="confirmed",
        is_new=is_new,
    )


def test_policy_returns_pass_on_clean_scan():
    """Verify that a clean scan with successful scanners returns PASS."""
    evaluator = DeterministicPolicyEvaluator()
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]
    result = evaluator.evaluate(findings=[], scanners=scanners)

    assert result.verdict in ("PASS", "pass")
    assert result.passed is True
    assert result.blocking_findings_count == 0
    assert "Clean scan" in result.summary


def test_policy_returns_fail_on_critical_or_high_findings():
    """Verify that confirmed critical or high findings trigger FAIL."""
    evaluator = DeterministicPolicyEvaluator()
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    crit = _make_finding(fid="crit-1", severity="critical", category="sast")
    result = evaluator.evaluate(findings=[crit], scanners=scanners)

    assert result.verdict in ("FAIL", "fail")
    assert result.passed is False
    assert result.blocking_findings_count == 1
    assert result.critical_count == 1
    assert any("Critical severity" in r for r in result.blocking_reasons)


def test_policy_returns_fail_on_exposed_secrets():
    """Verify that exposed secrets trigger FAIL regardless of general severity settings."""
    config = SecurityPolicyConfig(block_critical=False, block_high=False, block_exposed_secrets=True)
    evaluator = DeterministicPolicyEvaluator(config=config)
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    secret_f = _make_finding(fid="sec-1", rule_id="SEC-SECRET-001", category="secret", severity="high")
    result = evaluator.evaluate(findings=[secret_f], scanners=scanners)

    assert result.verdict in ("FAIL", "fail")
    assert result.passed is False
    assert result.exposed_secrets_count == 1
    assert any("Exposed secret violation" in r for r in result.blocking_reasons)


def test_policy_returns_incomplete_on_failed_or_missing_scanners():
    """Verify that failed or missing required scanners trigger INCOMPLETE and never PASS."""
    config = SecurityPolicyConfig(required_scanners={"flowguard-secrets"})
    evaluator = DeterministicPolicyEvaluator(config=config)

    # Case A: A scanner failed
    failed_meta = [
        ScannerExecutionMetadata(scanner="flowguard-secrets", status="failed", error_message="Fatal crash"),
    ]
    res_failed = evaluator.evaluate(findings=[], scanners=failed_meta)
    assert res_failed.verdict == "INCOMPLETE"
    assert res_failed.passed is False
    assert "flowguard-secrets" in res_failed.failed_scanners

    # Case B: Required scanner was missing
    empty_scanners: list[ScannerExecutionMetadata] = []
    res_missing = evaluator.evaluate(findings=[], scanners=empty_scanners)
    assert res_missing.verdict == "INCOMPLETE"
    assert res_missing.passed is False
    assert "flowguard-secrets" in res_missing.missing_required_scanners


def test_policy_returns_incomplete_on_security_test_failure():
    """Verify that security test execution failure triggers INCOMPLETE."""
    config = SecurityPolicyConfig(block_on_security_test_failure=True)
    evaluator = DeterministicPolicyEvaluator(config=config)
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    result = evaluator.evaluate(
        findings=[],
        scanners=scanners,
        security_tests_passed=False,
    )
    assert result.verdict == "INCOMPLETE"
    assert result.passed is False
    assert any("security test suite execution failed" in r for r in result.blocking_reasons)


def test_policy_returns_fail_on_patch_validation_failure():
    """Verify that failed patch revalidation triggers FAIL."""
    config = SecurityPolicyConfig(block_on_patch_validation_failure=True)
    evaluator = DeterministicPolicyEvaluator(config=config)
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    result = evaluator.evaluate(
        findings=[],
        scanners=scanners,
        patch_validation_passed=False,
    )
    assert result.verdict in ("FAIL", "fail")
    assert result.passed is False
    assert any("patch revalidation failed" in r.lower() for r in result.blocking_reasons)


def test_dependency_severity_thresholds_and_informational_findings():
    """Verify explicit dependency thresholds and non-blocking informational warnings."""
    # Policy: block critical/high dependencies, permit medium/low dependencies as informational
    config = SecurityPolicyConfig(
        dependency_blocking_severities={"critical", "high"},
        block_medium=False,
    )
    evaluator = DeterministicPolicyEvaluator(config=config)
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    med_dep = _make_finding(fid="dep-med", rule_id="GHSA-1", category="dependency", severity="medium")
    low_dep = _make_finding(fid="dep-low", rule_id="GHSA-2", category="dependency", severity="low")

    result = evaluator.evaluate(findings=[med_dep, low_dep], scanners=scanners)
    assert result.verdict in ("PASS", "pass")
    assert result.passed is True
    assert result.blocking_findings_count == 0
    assert result.informational_findings_count == 2
    assert "non-blocking informational" in result.summary


def test_baseline_comparison_and_preexisting_reporting():
    """Verify that pre-existing findings are never hidden and are separated from new findings."""
    config = SecurityPolicyConfig(enforce_new_findings_only=True)
    evaluator = DeterministicPolicyEvaluator(config=config)
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    pre_existing_crit = _make_finding(fid="pre-1", rule_id="CVE-2025-001", severity="critical", is_new=False)
    new_warning = _make_finding(fid="new-1", rule_id="SEC-WARN", severity="low", is_new=True)

    result = evaluator.evaluate(findings=[pre_existing_crit, new_warning], scanners=scanners)

    # Pre-existing finding is reported transparently and not hidden!
    assert result.pre_existing_findings_count == 1
    assert result.pre_existing_blocking_count == 1
    assert result.new_findings_count == 1
    assert result.new_blocking_count == 0
    # Because enforce_new_findings_only=True and there are no new blocking flaws, verdict is PASS with notice
    assert result.verdict in ("PASS", "pass")
    assert result.passed is True
    assert "pre-existing baseline findings detected" in result.summary


def test_baseline_comparison_blocking_when_all_findings_enforced():
    """Verify that when enforce_new_findings_only=False, pre-existing critical flaws fail the policy."""
    config = SecurityPolicyConfig(enforce_new_findings_only=False)
    evaluator = DeterministicPolicyEvaluator(config=config)
    scanners = [ScannerExecutionMetadata(scanner="flowguard-secrets", status="completed")]

    pre_existing_crit = _make_finding(fid="pre-1", rule_id="CVE-2025-001", severity="critical", is_new=False)
    result = evaluator.evaluate(findings=[pre_existing_crit], scanners=scanners)

    assert result.verdict in ("FAIL", "fail")
    assert result.passed is False
    assert result.blocking_findings_count == 1
    assert result.pre_existing_blocking_count == 1


def test_resilience_scoring_formula_unchanged():
    """Verify that resilience scores for BASE_EDGES and PR 12 remain exactly 84 and 32."""
    base_score, _, _ = resilience_score(BASE_EDGES)
    assert base_score == 84

    pr12_edges = pr_edges(12)
    pr12_score, _, _ = resilience_score(pr12_edges)
    assert pr12_score == 32
