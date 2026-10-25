"""Data models and normalization schemas for the FLOWGUARD Security Layer."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Set
from pydantic import BaseModel, Field

FindingCategory = Literal["secret", "sast", "dependency", "iac", "auth", "network"]
SeverityLevel = Literal["critical", "high", "medium", "low", "info"]
ScannerStatus = Literal["completed", "failed", "unavailable", "skipped"]
PolicyVerdict = Literal["PASS", "FAIL", "INCOMPLETE", "pass", "fail", "incomplete", "error"]


class NormalizedFinding(BaseModel):
    """Normalized security finding matching the standard repository schema."""
    id: str = Field(description="Unique deterministic ID for this finding")
    scanner: str = Field(description="Scanner identifier (e.g., flowguard-secrets, bandit, pip-audit, npm-audit)")
    rule_id: str = Field(description="Scanner-specific rule identifier (e.g. SEC-SECRET-001, B110, CVE-2026-...)")
    category: FindingCategory = Field(description="Category of security flaw")
    severity: SeverityLevel = Field(description="Normalized severity level")
    title: str = Field(description="Short human-readable summary of the finding")
    explanation: str = Field(description="In-depth explanation of the security risk and potential impact")
    file_path: Optional[str] = Field(default=None, description="Target file path relative to repo root")
    line_number: Optional[int] = Field(default=None, description="Starting line number of the vulnerability")
    remediation: str = Field(description="Actionable guidance to remediate the vulnerability")
    confidence: Optional[str] = Field(default="high", description="Confidence or verification status")
    package_name: Optional[str] = Field(default=None, description="Vulnerable package name (for dependency CVEs)")
    advisory_id: Optional[str] = Field(default=None, description="Security advisory identifier (CVE or GHSA)")
    is_new: bool = Field(default=True, description="True if introduced by this PR, False if pre-existing in baseline")
    raw_snippet: Optional[str] = Field(default=None, description="Sanitized/redacted code snippet illustrating the issue")


class ScannerExecutionMetadata(BaseModel):
    """Execution status and diagnostics for an individual scanner."""
    scanner: str = Field(description="Name of the scanner")
    status: ScannerStatus = Field(description="completed | failed | unavailable | skipped")
    version: Optional[str] = Field(default=None, description="Scanner tool version")
    duration_ms: float = Field(default=0.0, description="Execution time in milliseconds")
    findings_count: int = Field(default=0, description="Total findings detected by this scanner")
    error_message: Optional[str] = Field(default=None, description="Error or reason if failed or unavailable")


class SecurityPolicyConfig(BaseModel):
    """Configurable rules and thresholds for the deterministic security policy."""
    policy_name: str = "default-flowguard-policy"
    policy_version: str = "1.1.0"
    
    # Severity & Category Blocking Rules
    block_critical: bool = True
    block_high: bool = True
    block_medium: bool = False
    block_exposed_secrets: bool = True
    
    # Explicit Dependency Severity Threshold
    dependency_blocking_severities: Set[SeverityLevel] = {"critical", "high"}
    
    # Scanner Requirements
    required_scanners: Set[str] = Field(default_factory=set)
    fail_on_missing_required_scanners: bool = True
    
    # Test & Patch Validation Rules
    block_on_security_test_failure: bool = True
    block_on_patch_validation_failure: bool = True
    
    # Baseline comparison behavior
    enforce_new_findings_only: bool = False  # If True, only newly introduced findings cause FAIL
    
    # Exempted rule IDs
    exempt_rules: Set[str] = Field(default_factory=set)


class PolicyEvaluationResult(BaseModel):
    """Comprehensive security policy evaluation outcome."""
    verdict: PolicyVerdict = Field(description="PASS | FAIL | INCOMPLETE")
    passed: bool = Field(description="True if security checks pass without blocking flaws or incomplete scanners")
    
    # Categorical counts
    blocking_findings_count: int = Field(default=0, description="Count of findings violating the policy")
    informational_findings_count: int = Field(default=0, description="Count of non-blocking informational/warning findings")
    critical_count: int = Field(default=0)
    high_count: int = Field(default=0)
    medium_count: int = Field(default=0)
    low_count: int = Field(default=0)
    info_count: int = Field(default=0)
    exposed_secrets_count: int = Field(default=0)
    vulnerable_dependencies_count: int = Field(default=0)
    
    # Baseline breakdown
    new_findings_count: int = Field(default=0)
    pre_existing_findings_count: int = Field(default=0)
    new_blocking_count: int = Field(default=0)
    pre_existing_blocking_count: int = Field(default=0)
    
    # Diagnostics & Explanation
    blocking_reasons: List[str] = Field(default_factory=list)
    failed_scanners: List[str] = Field(default_factory=list)
    missing_required_scanners: List[str] = Field(default_factory=list)
    summary: str = Field(description="Human-readable policy verdict summary")
    policy_version: str = Field(default="1.1.0", description="Version of security policy applied")


class SecurityScanReport(BaseModel):
    """Complete security analysis report for a pull request or patch."""
    scan_id: str = Field(description="Unique scan run identifier")
    pr_id: Any = Field(description="Associated pull request ID (integer or string)")
    tenant_id: str = Field(default="demo", description="Tenant isolation identifier")
    commit_or_patch_hash: str = Field(description="SHA-256 hash of the PR diff or commit snapshot")
    timestamp: str = Field(description="ISO-8601 UTC timestamp of scan execution")
    policy_version: str = Field(default="1.1.0")
    scanners: List[ScannerExecutionMetadata] = Field(default_factory=list)
    findings: List[NormalizedFinding] = Field(default_factory=list)
    policy: PolicyEvaluationResult
    is_clean: bool = Field(description="True if no vulnerabilities were detected across all executed scanners")
    has_failures: bool = Field(description="True if any scanner encountered an execution failure")
    remediation_patch: Optional[str] = Field(default=None, description="Suggested unified diff patch to fix findings")
