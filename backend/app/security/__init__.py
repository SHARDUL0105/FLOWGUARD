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
from .revalidation import revalidate_patch

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
    "evaluate_combined_matrix",
    "evaluate_security_policy",
    "mask_secret",
    "redact_text",
    "revalidate_patch",
    "scan_pr_security",
    "verify_pr_combined",
]
