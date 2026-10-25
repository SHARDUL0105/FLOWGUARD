"""Bandit SAST scanner integration.
Executes Bandit on Python targets and normalizes findings into the FLOWGUARD schema.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import sys
import time
from typing import List, Optional, Tuple

from ..models import NormalizedFinding, ScannerExecutionMetadata
from ..redactor import redact_text
from ..subprocess_runner import run_command_safely

SCANNER_NAME = "bandit"


def find_bandit_binary() -> Optional[str]:
    """Locate the bandit executable in the active virtual environment or PATH."""
    venv_bin = Path(sys.executable).parent / ("bandit.exe" if os.name == "nt" else "bandit")
    if venv_bin.exists():
        return str(venv_bin)
    found = shutil.which("bandit")
    return found


def normalize_bandit_severity(sev: str) -> str:
    """Map Bandit severity string (HIGH/MEDIUM/LOW) to standard schema."""
    s = sev.lower()
    if s == "high":
        return "high"
    elif s == "medium":
        return "medium"
    elif s == "low":
        return "low"
    return "info"


def run_bandit_scan(
    target_path: str,
    timeout: float = 20.0,
) -> Tuple[List[NormalizedFinding], ScannerExecutionMetadata]:
    """Execute Bandit against a file or directory and return normalized findings.

    Args:
        target_path: Absolute or relative path to scan.
        timeout: Execution timeout in seconds.

    Returns:
        Tuple of (findings_list, execution_metadata).
    """
    t0 = time.perf_counter()
    bandit_bin = find_bandit_binary()

    if not bandit_bin:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="unavailable",
            duration_ms=duration_ms,
            findings_count=0,
            error_message="Executable 'bandit' not found in current environment.",
        )
        return [], meta

    # Construct safe argument list
    args = [bandit_bin, "-r", target_path, "-f", "json", "-q"]
    res = run_command_safely(args, timeout=timeout)
    duration_ms = res.duration_ms

    if res.timed_out:
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Bandit scan timed out after {timeout}s",
        )
        return [], meta

    # Bandit exits with 0 (no issues), 1 (issues found), or >1 (fatal error)
    if res.returncode not in (0, 1):
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Bandit failed with exit code {res.returncode}: {res.stderr[:300]}",
        )
        return [], meta

    findings: List[NormalizedFinding] = []
    try:
        # Extract JSON from stdout (ignoring any leading banner messages)
        json_start = res.stdout.find("{")
        json_end = res.stdout.rfind("}")
        if json_start != -1 and json_end != -1:
            data = json.loads(res.stdout[json_start : json_end + 1])
        else:
            data = {}

        results = data.get("results", [])
        for item in results:
            rule_id = item.get("test_id", "BANDIT-RULE")
            test_name = item.get("test_name", "sast_issue")
            raw_sev = item.get("issue_severity", "MEDIUM")
            confidence = item.get("issue_confidence", "HIGH").lower()
            explanation = item.get("issue_text", "Python security issue detected.")
            filename = item.get("filename", target_path)
            line_no = item.get("line_number")
            more_info = item.get("more_info", "")
            code_snippet = item.get("code", "")

            # Make file path relative if possible
            try:
                rel_path = os.path.relpath(filename)
            except Exception:
                rel_path = filename

            finding_id = f"find-bandit-{rule_id.lower()}-{hash(str(rel_path) + str(line_no)) % 1000000:06d}"
            finding = NormalizedFinding(
                id=finding_id,
                scanner=SCANNER_NAME,
                rule_id=rule_id,
                category="sast",
                severity=normalize_bandit_severity(raw_sev),  # type: ignore[arg-type]
                title=f"Bandit {rule_id}: {test_name}",
                explanation=explanation,
                file_path=rel_path,
                line_number=line_no,
                remediation=f"Inspect line {line_no} and resolve according to Bandit guidelines: {more_info}" if more_info else "Review and remediate according to secure coding guidelines.",
                confidence=confidence,
                is_new=True,
                raw_snippet=redact_text(code_snippet[:300]) if code_snippet else None,
            )
            findings.append(finding)

        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="completed",
            duration_ms=duration_ms,
            findings_count=len(findings),
        )
        return findings, meta

    except Exception as e:
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Failed to parse Bandit JSON output: {e}",
        )
        return [], meta
