"""Native static secret and credential scanner.
Inspects pull request diffs and repository files for leaked secrets, API keys, private keys,
and hardcoded credentials without executing application code.
"""
from __future__ import annotations

import hashlib
import re
import time
from typing import List, Optional, Tuple

from .models import NormalizedFinding, ScannerExecutionMetadata
from .redactor import mask_secret, redact_text

SCANNER_NAME = "flowguard-secrets"

# Rule definitions: (rule_id, title, category, severity, pattern, explanation, remediation)
SECRET_RULES: List[Tuple[str, str, str, str, re.Pattern, str, str]] = [
    (
        "SEC-SECRET-001",
        "AWS Access Key ID Detected",
        "secret",
        "critical",
        re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "A plaintext AWS Access Key ID was exposed. If committed, attackers can enumerate cloud resources.",
        "Store AWS credentials in environment variables or an AWS Secrets Manager secret, never in source code.",
    ),
    (
        "SEC-SECRET-002",
        "Stripe Live API Secret Key Detected",
        "secret",
        "critical",
        re.compile(r"\b(sk_live_[0-9a-zA-Z]{24,34}|rk_live_[0-9a-zA-Z]{24,34})\b"),
        "A live production Stripe API key was detected in code/diff. Attackers could perform unauthorized charges or refunds.",
        "Revoke this key immediately in Stripe Dashboard and migrate to environment variables or secret vaults.",
    ),
    (
        "SEC-SECRET-003",
        "GitHub Personal Access Token Detected",
        "secret",
        "high",
        re.compile(r"\b(ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})\b"),
        "A GitHub Personal Access Token was identified. An adversary could gain read/write access to repositories.",
        "Revoke this token from GitHub settings and load tokens via CI/CD secrets or short-lived OIDC tokens.",
    ),
    (
        "SEC-SECRET-004",
        "Private Cryptographic Key Detected",
        "secret",
        "critical",
        re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
        "An unencrypted private key header was found. Leaking private keys compromises cryptographic identity.",
        "Remove the private key from version control, rotate certificates, and store keys in KMS or Vault.",
    ),
    (
        "SEC-SECRET-005",
        "Hardcoded Database Connection String with Credentials",
        "secret",
        "high",
        re.compile(r"(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)"),
        "A database connection string containing a plaintext password was identified.",
        "Inject the database connection string dynamically using secret environment variables.",
    ),
    (
        "SEC-SECRET-006",
        "Hardcoded Plaintext Password or Token Assignment",
        "secret",
        "high",
        re.compile(r"(?i)\b(password|passwd|api_key|apikey|auth_token)\s*[:=]\s*['\"]([^'\"\s\r\n]{8,})['\"]"),
        "A variable assignment contains a plaintext password or API token.",
        "Refactor configuration to read passwords from environment variables or a configuration server.",
    ),
    (
        "SEC-AUTH-001",
        "Insecure Plaintext Transport Endpoint",
        "network",
        "medium",
        re.compile(r"['\"]http:\/\/(?!localhost|127\.0\.0\.1)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['\"]"),
        "Plaintext HTTP protocol used for an external endpoint, exposing traffic to eavesdropping and MITM attacks.",
        "Enforce TLS (https://) for all non-local service endpoints.",
    ),
]


def _generate_finding_id(rule_id: str, file_path: str, line_no: int, matched_snippet: str) -> str:
    """Generate a deterministic finding ID based on rule, location, and issue hash."""
    raw = f"{rule_id}:{file_path}:{line_no}:{matched_snippet}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    return f"find-{rule_id.lower()}-{h}"


def parse_diff_lines(diff_text: str) -> List[Tuple[str, int, str]]:
    """Parse unified diff lines into (file_path, line_number, added_content).

    Only inspects lines added or modified (starting with '+', excluding '+++').
    """
    entries: List[Tuple[str, int, str]] = []
    current_file = "diff"
    current_line = 0

    for raw_line in diff_text.splitlines():
        if raw_line.startswith("+++ b/"):
            current_file = raw_line[6:].strip()
            continue
        elif raw_line.startswith("+++ "):
            current_file = raw_line[4:].strip()
            continue

        hunk_match = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw_line)
        if hunk_match:
            current_line = int(hunk_match.group(1))
            continue

        if raw_line.startswith("+") and not raw_line.startswith("+++"):
            added_content = raw_line[1:]
            entries.append((current_file, current_line, added_content))
            current_line += 1
        elif not raw_line.startswith("-"):
            current_line += 1

    return entries


def scan_diff_for_secrets(diff_text: str) -> Tuple[List[NormalizedFinding], ScannerExecutionMetadata]:
    """Scan a unified diff string for secrets and credentials.

    Returns:
        Tuple of (findings_list, execution_metadata).
    """
    t0 = time.perf_counter()
    findings: List[NormalizedFinding] = []

    if not diff_text or not diff_text.strip():
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="completed",
            duration_ms=duration_ms,
            findings_count=0,
        )
        return findings, meta

    parsed_lines = parse_diff_lines(diff_text)
    # If not a unified diff with hunks, fallback to scanning line-by-line
    if not parsed_lines:
        parsed_lines = [("diff_snippet", idx + 1, l) for idx, l in enumerate(diff_text.splitlines())]

    for file_path, line_no, line_content in parsed_lines:
        for rule_id, title, category, severity, pattern, explanation, remediation in SECRET_RULES:
            match = pattern.search(line_content)
            if match:
                matched_raw = match.group(0)
                # Ignore obvious false-positive placeholders
                if any(ph in matched_raw.lower() for ph in ("placeholder", "xxxxxxxx")):
                    continue

                safe_snippet = redact_text(line_content.strip())
                finding_id = _generate_finding_id(rule_id, file_path, line_no, matched_raw)

                finding = NormalizedFinding(
                    id=finding_id,
                    scanner=SCANNER_NAME,
                    rule_id=rule_id,
                    category=category,  # type: ignore[arg-type]
                    severity=severity,  # type: ignore[arg-type]
                    title=title,
                    explanation=explanation,
                    file_path=file_path,
                    line_number=line_no,
                    remediation=remediation,
                    confidence="high",
                    is_new=True,
                    raw_snippet=safe_snippet,
                )
                findings.append(finding)

    duration_ms = round((time.perf_counter() - t0) * 1000, 2)
    meta = ScannerExecutionMetadata(
        scanner=SCANNER_NAME,
        status="completed",
        duration_ms=duration_ms,
        findings_count=len(findings),
    )
    return findings, meta
