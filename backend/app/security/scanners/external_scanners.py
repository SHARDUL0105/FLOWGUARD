"""External optional security scanners (Gitleaks and Semgrep).
Detects tool availability transparently and reports explicit status metadata.
Never fabricates findings and never marks an unexecuted scan as passed.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from typing import List, Optional, Tuple

from ..models import NormalizedFinding, ScannerExecutionMetadata
from ..subprocess_runner import run_command_safely


def run_gitleaks_scan(
    target_path: str,
    timeout: float = 20.0,
) -> Tuple[List[NormalizedFinding], ScannerExecutionMetadata]:
    """Execute Gitleaks if installed, otherwise report explicit unavailability."""
    t0 = time.perf_counter()
    gitleaks_bin = shutil.which("gitleaks")

    if not gitleaks_bin:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner="gitleaks",
            status="unavailable",
            duration_ms=duration_ms,
            findings_count=0,
            error_message="Executable 'gitleaks' not found on system PATH.",
        )
        return [], meta

    args = [gitleaks_bin, "detect", "--no-git", "--source", target_path, "--report-format", "json", "-v"]
    res = run_command_safely(args, timeout=timeout)
    duration_ms = res.duration_ms

    if res.timed_out:
        meta = ScannerExecutionMetadata(
            scanner="gitleaks",
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Gitleaks scan timed out after {timeout}s",
        )
        return [], meta

    # Gitleaks exits with 0 (clean) or 1 (leaks found)
    if res.returncode not in (0, 1):
        meta = ScannerExecutionMetadata(
            scanner="gitleaks",
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Gitleaks failed with exit code {res.returncode}: {res.stderr[:300]}",
        )
        return [], meta

    findings: List[NormalizedFinding] = []
    try:
        if res.stdout.strip():
            raw_leaks = json.loads(res.stdout)
            for leak in raw_leaks:
                rule_id = leak.get("RuleID", "GITLEAKS-LEAK")
                desc = leak.get("Description", "Secret detected by Gitleaks")
                file_p = leak.get("File", target_path)
                line_no = leak.get("StartLine")

                finding = NormalizedFinding(
                    id=f"find-gitleaks-{rule_id.lower()}-{hash(str(file_p) + str(line_no)) % 1000000:06d}",
                    scanner="gitleaks",
                    rule_id=rule_id,
                    category="secret",
                    severity="critical",
                    title=f"Gitleaks: {desc}",
                    explanation=f"Potential secret detected matching rule {rule_id}.",
                    file_path=file_p,
                    line_number=line_no,
                    remediation="Rotate exposed credential immediately and replace with environment secret injection.",
                    confidence="high",
                    is_new=True,
                )
                findings.append(finding)

        meta = ScannerExecutionMetadata(
            scanner="gitleaks",
            status="completed",
            duration_ms=duration_ms,
            findings_count=len(findings),
        )
        return findings, meta

    except Exception as e:
        meta = ScannerExecutionMetadata(
            scanner="gitleaks",
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Failed to parse Gitleaks JSON: {e}",
        )
        return [], meta


def run_semgrep_scan(
    target_path: str,
    timeout: float = 30.0,
) -> Tuple[List[NormalizedFinding], ScannerExecutionMetadata]:
    """Execute Semgrep if installed, otherwise report explicit unavailability."""
    t0 = time.perf_counter()
    semgrep_bin = shutil.which("semgrep")

    if not semgrep_bin:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner="semgrep",
            status="unavailable",
            duration_ms=duration_ms,
            findings_count=0,
            error_message="Executable 'semgrep' not found on system PATH.",
        )
        return [], meta

    args = [semgrep_bin, "scan", "--config", "auto", "--json", target_path]
    res = run_command_safely(args, timeout=timeout)
    duration_ms = res.duration_ms

    if res.timed_out:
        meta = ScannerExecutionMetadata(
            scanner="semgrep",
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Semgrep timed out after {timeout}s",
        )
        return [], meta

    if res.returncode not in (0, 1):
        meta = ScannerExecutionMetadata(
            scanner="semgrep",
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Semgrep failed with exit code {res.returncode}: {res.stderr[:300]}",
        )
        return [], meta

    findings: List[NormalizedFinding] = []
    try:
        if res.stdout.strip():
            data = json.loads(res.stdout)
            results = data.get("results", [])
            for r in results:
                check_id = r.get("check_id", "SEMGREP-RULE")
                extra = r.get("extra", {})
                message = extra.get("message", "Semgrep security issue.")
                raw_sev = extra.get("severity", "WARNING").lower()
                sev = "high" if raw_sev == "error" else ("medium" if raw_sev == "warning" else "low")
                path_str = r.get("path", target_path)
                start_line = r.get("start", {}).get("line")

                finding = NormalizedFinding(
                    id=f"find-semgrep-{check_id.lower()}-{hash(str(path_str) + str(start_line)) % 1000000:06d}",
                    scanner="semgrep",
                    rule_id=check_id,
                    category="sast",
                    severity=sev,  # type: ignore[arg-type]
                    title=f"Semgrep {check_id}",
                    explanation=message,
                    file_path=path_str,
                    line_number=start_line,
                    remediation="Review and refactor vulnerable code pattern according to Semgrep rule recommendation.",
                    confidence="high",
                    is_new=True,
                )
                findings.append(finding)

        meta = ScannerExecutionMetadata(
            scanner="semgrep",
            status="completed",
            duration_ms=duration_ms,
            findings_count=len(findings),
        )
        return findings, meta

    except Exception as e:
        meta = ScannerExecutionMetadata(
            scanner="semgrep",
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"Failed to parse Semgrep JSON: {e}",
        )
        return [], meta
