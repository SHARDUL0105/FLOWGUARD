"""FLOWGUARD PR Security Layer Module.
Provides independent security scanning, finding normalization, policy evaluation,
patch revalidation, and audit report storage for pull requests.
"""
from __future__ import annotations

from .combined import (
    CombinedStatus,
    CombinedVerificationResult,
    evaluate_combined_matrix,
    verify_pr_combined,
)
from .fixtures import (
    export_fixtures_to_disk,
    get_all_four_cases,
    get_case_by_identifier,
)
from .models import (
    FindingCategory,
    NormalizedFinding,
    PolicyEvaluationResult,
    ScannerExecutionMetadata,
    SecurityPolicyConfig,
    SecurityScanReport,
    SeverityLevel,
)
from .orchestrator import scan_pr_security
from .policy import DeterministicPolicyEvaluator, evaluate_security_policy
from .redactor import mask_secret, redact_text
from .revalidation import (
    compare_security_findings,
    execute_simulated_merge,
    extract_changed_files_from_diff,
    get_reviewer_approval,
    record_reviewer_approval,
    revalidate_patch,
    revalidate_security_patch,
    validate_autofix_workflow,
)

__all__ = [
    "CombinedStatus",
    "CombinedVerificationResult",
    "DeterministicPolicyEvaluator",
    "FindingCategory",
    "NormalizedFinding",
    "PolicyEvaluationResult",
    "ScannerExecutionMetadata",
    "SecurityPolicyConfig",
    "SecurityScanReport",
    "SeverityLevel",
    "compare_security_findings",
    "evaluate_combined_matrix",
    "evaluate_security_policy",
    "execute_simulated_merge",
    "export_fixtures_to_disk",
    "extract_changed_files_from_diff",
    "get_all_four_cases",
    "get_case_by_identifier",
    "get_reviewer_approval",
    "mask_secret",
    "record_reviewer_approval",
    "redact_text",
    "revalidate_patch",
    "revalidate_security_patch",
    "scan_pr_security",
    "validate_autofix_workflow",
    "verify_pr_combined",
]
