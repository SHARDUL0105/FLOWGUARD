"""Deterministic Security Policy Evaluator.
Consumes normalized findings, scanner execution health, test statuses, and baseline comparisons.
Returns PASS, FAIL, or INCOMPLETE with transparent justification.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set
from .models import (
    NormalizedFinding,
    PolicyEvaluationResult,
    PolicyVerdict,
    ScannerExecutionMetadata,
    SecurityPolicyConfig,
    SeverityLevel,
)

POLICY_VERSION = "1.1.0"


class DeterministicPolicyEvaluator:
    """Evaluates security findings and scanner health according to deterministic, configurable rules."""

    def __init__(self, config: Optional[SecurityPolicyConfig] = None) -> None:
        self.config = config or SecurityPolicyConfig()

    def evaluate(
        self,
        findings: List[NormalizedFinding],
        scanners: List[ScannerExecutionMetadata],
        security_tests_passed: Optional[bool] = None,
        patch_validation_passed: Optional[bool] = None,
        baseline_findings: Optional[List[NormalizedFinding]] = None,
    ) -> PolicyEvaluationResult:
        """Execute deterministic policy evaluation.

        Outcomes:
        - INCOMPLETE: One or more required scanners failed/missing, or required security tests failed.
        - FAIL: One or more blocking vulnerabilities detected, or patch validation rejected.
        - PASS: All required checks completed and zero blocking flaws detected.
        """
        blocking_reasons: List[str] = []
        failed_scanners: List[str] = []
        missing_required_scanners: List[str] = []

        # 1. Evaluate Scanner Execution Health
        scanner_status_map = {s.scanner: s.status for s in scanners}
        for s in scanners:
            if s.status == "failed":
                failed_scanners.append(s.scanner)
                blocking_reasons.append(f"Required scanner '{s.scanner}' experienced an execution failure: {s.error_message or 'Unknown error'}")

        # Check required scanners
        if self.config.fail_on_missing_required_scanners:
            for req in self.config.required_scanners:
                status = scanner_status_map.get(req)
                if status is None:
                    missing_required_scanners.append(req)
                    blocking_reasons.append(f"Required scanner '{req}' was not executed.")
                elif status in ("failed", "unavailable", "skipped"):
                    if req not in failed_scanners:
                        missing_required_scanners.append(req)
                        blocking_reasons.append(f"Required scanner '{req}' did not complete successfully (status: {status}).")

        # 2. Evaluate Required Security Tests
        tests_failed = False
        if self.config.block_on_security_test_failure and security_tests_passed is False:
            tests_failed = True
            blocking_reasons.append("Required security test suite execution failed.")

        # If tooling or required tests did not complete, verdict is INCOMPLETE
        if failed_scanners or missing_required_scanners or tests_failed:
            summary = (
                f"Security Policy INCOMPLETE: Scanner execution failure or incomplete scan. "
                f"Failed: {failed_scanners or 'none'}, Missing: {missing_required_scanners or 'none'}."
            )
            return PolicyEvaluationResult(
                verdict="INCOMPLETE",
                passed=False,
                blocking_findings_count=len(blocking_reasons),
                informational_findings_count=0,
                blocking_reasons=blocking_reasons,
                failed_scanners=failed_scanners,
                missing_required_scanners=missing_required_scanners,
                summary=summary,
                policy_version=self.config.policy_version,
            )

        # 3. Baseline Hash Set for Pre-existing Comparison
        baseline_keys: Set[str] = set()
        if baseline_findings is not None:
            for bf in baseline_findings:
                # Key by rule_id and file_path to accurately detect pre-existing flaws
                baseline_keys.add(f"{bf.rule_id}:{bf.file_path}:{bf.line_number or ''}")

        # 4. Categorize Findings & Evaluate Policy Rules
        crit_c = 0
        high_c = 0
        med_c = 0
        low_c = 0
        info_c = 0
        secrets_c = 0
        deps_c = 0

        new_findings_c = 0
        pre_existing_findings_c = 0
        new_blocking_c = 0
        pre_existing_blocking_c = 0

        for f in findings:
            if f.rule_id in self.config.exempt_rules:
                continue

            sev = f.severity.lower()
            cat = f.category.lower()

            # Severity counts
            if sev == "critical":
                crit_c += 1
            elif sev == "high":
                high_c += 1
            elif sev == "medium":
                med_c += 1
            elif sev == "low":
                low_c += 1
            else:
                info_c += 1

            # Category counts
            if cat == "secret":
                secrets_c += 1
            elif cat == "dependency":
                deps_c += 1

            # Determine whether finding is new or pre-existing
            if baseline_findings is not None:
                match_key = f"{f.rule_id}:{f.file_path}:{f.line_number or ''}"
                is_new = match_key not in baseline_keys
            else:
                is_new = f.is_new

            if is_new:
                new_findings_c += 1
            else:
                pre_existing_findings_c += 1

            # Determine whether finding violates blocking policy
            is_blocking = False
            reason_label = "[NEW]" if is_new else "[PRE-EXISTING]"

            # Rule: Exposed secrets
            if self.config.block_exposed_secrets and cat == "secret":
                is_blocking = True
                blocking_reasons.append(f"{reason_label} Exposed secret violation: {f.title} ({f.rule_id}) at {f.file_path or 'unknown'}:{f.line_number or ''}")

            # Rule: Vulnerable dependencies threshold
            elif cat == "dependency":
                if sev in self.config.dependency_blocking_severities:
                    is_blocking = True
                    blocking_reasons.append(f"{reason_label} Vulnerable dependency exceeding threshold: {f.title} ({sev.upper()})")

            # Rule: General Critical findings
            elif self.config.block_critical and sev == "critical":
                is_blocking = True
                blocking_reasons.append(f"{reason_label} Critical severity vulnerability: {f.title} ({f.rule_id}) at {f.file_path or 'unknown'}")

            # Rule: General High findings
            elif self.config.block_high and sev == "high":
                is_blocking = True
                blocking_reasons.append(f"{reason_label} High severity vulnerability: {f.title} ({f.rule_id}) at {f.file_path or 'unknown'}")

            # Rule: Medium findings (configurable, default False)
            elif self.config.block_medium and sev == "medium":
                is_blocking = True
                blocking_reasons.append(f"{reason_label} Medium severity finding blocked by strict policy: {f.title} ({f.rule_id})")

            if is_blocking:
                if is_new:
                    new_blocking_c += 1
                else:
                    pre_existing_blocking_c += 1

        total_blocking = new_blocking_c + pre_existing_blocking_c
        informational_c = len(findings) - total_blocking

        # 5. Evaluate Patch Revalidation Rule
        if self.config.block_on_patch_validation_failure and patch_validation_passed is False:
            blocking_reasons.append("Security patch revalidation failed or was rejected.")
            total_blocking += 1
            new_blocking_c += 1

        # 6. Compute Final Policy Verdict
        if self.config.enforce_new_findings_only:
            violates_policy = new_blocking_c > 0
        else:
            violates_policy = total_blocking > 0

        if violates_policy:
            verdict: PolicyVerdict = "FAIL"
            passed = False
            summary = (
                f"Security Policy FAIL: {total_blocking} blocking vulnerabilities detected "
                f"({new_blocking_c} new, {pre_existing_blocking_c} pre-existing). "
                f"Secrets: {secrets_c}, Critical: {crit_c}, High: {high_c}."
            )
        else:
            verdict = "PASS"
            passed = True
            if len(findings) == 0:
                summary = "Security Policy PASS: Clean scan with zero security findings across all configured scanners."
            else:
                summary = f"Security Policy PASS: {informational_c} non-blocking informational/advisory findings. Zero blocking flaws."
                if pre_existing_blocking_c > 0 and self.config.enforce_new_findings_only:
                    summary += f" (Notice: {pre_existing_blocking_c} pre-existing baseline findings detected but exempt by new-findings policy)."

        return PolicyEvaluationResult(
            verdict=verdict,
            passed=passed,
            blocking_findings_count=total_blocking,
            informational_findings_count=informational_c,
            critical_count=crit_c,
            high_count=high_c,
            medium_count=med_c,
            low_count=low_c,
            info_count=info_c,
            exposed_secrets_count=secrets_c,
            vulnerable_dependencies_count=deps_c,
            new_findings_count=new_findings_c,
            pre_existing_findings_count=pre_existing_findings_c,
            new_blocking_count=new_blocking_c,
            pre_existing_blocking_count=pre_existing_blocking_c,
            blocking_reasons=blocking_reasons,
            failed_scanners=failed_scanners,
            missing_required_scanners=missing_required_scanners,
            summary=summary,
            policy_version=self.config.policy_version,
        )


# Backward-compatible functional interface
def evaluate_security_policy(
    findings: List[NormalizedFinding],
    scanners: List[ScannerExecutionMetadata],
    blocking_severities: Optional[Set[str]] = None,
    exempt_rules: Optional[Set[str]] = None,
    config: Optional[SecurityPolicyConfig] = None,
    security_tests_passed: Optional[bool] = None,
    patch_validation_passed: Optional[bool] = None,
    baseline_findings: Optional[List[NormalizedFinding]] = None,
) -> PolicyEvaluationResult:
    """Evaluate normalized findings and scanner health using the DeterministicPolicyEvaluator."""
    if config is None:
        config = SecurityPolicyConfig()
        if blocking_severities is not None:
            config.block_critical = "critical" in blocking_severities
            config.block_high = "high" in blocking_severities
            config.block_medium = "medium" in blocking_severities
        if exempt_rules is not None:
            config.exempt_rules = exempt_rules

    evaluator = DeterministicPolicyEvaluator(config=config)
    return evaluator.evaluate(
        findings=findings,
        scanners=scanners,
        security_tests_passed=security_tests_passed,
        patch_validation_passed=patch_validation_passed,
        baseline_findings=baseline_findings,
    )
