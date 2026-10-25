"""npm audit frontend dependency vulnerability scanner integration.
Audits Node.js / React frontend dependencies for security advisories and normalizes findings.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from typing import List, Optional, Tuple

from ..models import NormalizedFinding, ScannerExecutionMetadata
from ..subprocess_runner import run_command_safely

SCANNER_NAME = "npm-audit"


def find_npm_binary() -> Optional[str]:
    """Locate npm executable across platforms."""
    if os.name == "nt":
        return shutil.which("npm.cmd") or shutil.which("npm")
    return shutil.which("npm")


def normalize_npm_severity(sev: str) -> str:
    """Map npm severity (critical/high/moderate/low/info) to standard schema."""
    s = sev.lower()
    if s == "critical":
        return "critical"
    elif s == "high":
        return "high"
    elif s == "moderate":
        return "medium"
    elif s == "low":
        return "low"
    return "info"


def run_npm_audit_scan(
    frontend_dir: str,
    timeout: float = 25.0,
) -> Tuple[List[NormalizedFinding], ScannerExecutionMetadata]:
    """Execute npm audit --json in the frontend directory.

    Args:
        frontend_dir: Path to directory containing package.json / package-lock.json.
        timeout: Execution timeout in seconds.

    Returns:
        Tuple of (findings_list, execution_metadata).
    """
    t0 = time.perf_counter()
    npm_bin = find_npm_binary()

    if not npm_bin:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="unavailable",
            duration_ms=duration_ms,
            findings_count=0,
            error_message="Executable 'npm' not found on system PATH.",
        )
        return [], meta

    pkg_json = os.path.join(frontend_dir, "package.json")
    if not os.path.exists(pkg_json):
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="skipped",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"No package.json found in {frontend_dir}.",
        )
        return [], meta

    args = [npm_bin, "audit", "--json"]
    res = run_command_safely(args, cwd=frontend_dir, timeout=timeout)
    duration_ms = res.duration_ms

    if res.timed_out:
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"npm audit timed out after {timeout}s",
        )
        return [], meta

    findings: List[NormalizedFinding] = []
    try:
        json_start = res.stdout.find("{")
        json_end = res.stdout.rfind("}")
        if json_start != -1 and json_end != -1:
            data = json.loads(res.stdout[json_start : json_end + 1])
        else:
            data = {}

        vulns = data.get("vulnerabilities", {})
        for pkg_name, info in vulns.items():
            raw_sev = info.get("severity", "moderate")
            severity = normalize_npm_severity(raw_sev)
            fix_info = info.get("fixAvailable", False)
            via = info.get("via", [])

            # Extract advisory details from 'via'
            advisory_id = None
            title = f"Vulnerability in {pkg_name}"
            explanation = f"Package {pkg_name} contains known security vulnerabilities."

            for v in via:
                if isinstance(v, dict):
                    advisory_id = v.get("url", "").split("/")[-1] if v.get("url") else v.get("title")
                    title = v.get("title", title)
                    explanation = f"Advisory {advisory_id}: {title} (Range: {v.get('range', 'all')})"
                    break

            if isinstance(fix_info, dict):
                remediation = f"Update {fix_info.get('name')} to version {fix_info.get('version')}."
            elif fix_info is True:
                remediation = f"Run 'npm audit fix' to upgrade {pkg_name}."
            else:
                remediation = f"Review dependency tree for {pkg_name} and consider updating or replacing."

            finding_id = f"find-npm-{pkg_name}-{hash(str(advisory_id)) % 1000000:06d}"
            finding = NormalizedFinding(
                id=finding_id,
                scanner=SCANNER_NAME,
                rule_id=str(advisory_id or f"NPM-{pkg_name.upper()}"),
                category="dependency",
                severity=severity,  # type: ignore[arg-type]
                title=f"npm advisory: {title}",
                explanation=explanation,
                file_path="frontend/package.json",
                remediation=remediation,
                confidence="confirmed",
                package_name=pkg_name,
                advisory_id=str(advisory_id) if advisory_id else None,
                is_new=True,
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
            error_message=f"Failed to parse npm audit JSON output: {e}",
        )
        return [], meta
