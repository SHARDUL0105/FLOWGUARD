"""pip-audit dependency vulnerability scanner integration.
Audits Python packages and requirements for known CVEs/GHSAs and normalizes findings.
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
from ..subprocess_runner import run_command_safely

SCANNER_NAME = "pip-audit"


def find_pip_audit_binary() -> Optional[str]:
    """Locate the pip-audit executable in active venv or PATH."""
    venv_bin = Path(sys.executable).parent / ("pip-audit.exe" if os.name == "nt" else "pip-audit")
    if venv_bin.exists():
        return str(venv_bin)
    return shutil.which("pip-audit")


def run_pip_audit_scan(
    requirements_file: Optional[str] = None,
    timeout: float = 30.0,
) -> Tuple[List[NormalizedFinding], ScannerExecutionMetadata]:
    """Execute pip-audit against requirements or installed environment.

    Args:
        requirements_file: Optional path to requirements.txt.
        timeout: Execution timeout in seconds.

    Returns:
        Tuple of (findings_list, execution_metadata).
    """
    t0 = time.perf_counter()
    audit_bin = find_pip_audit_binary()

    if not audit_bin:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="unavailable",
            duration_ms=duration_ms,
            findings_count=0,
            error_message="Executable 'pip-audit' not found in current environment.",
        )
        return [], meta

    args = [audit_bin, "--format", "json"]
    if requirements_file and os.path.isfile(requirements_file):
        args.extend(["-r", requirements_file])

    res = run_command_safely(args, timeout=timeout)
    duration_ms = res.duration_ms

    if res.timed_out:
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"pip-audit timed out after {timeout}s",
        )
        return [], meta

    # pip-audit exits with 0 (clean) or 1 (vulns found); other codes indicate tool failure
    if res.returncode not in (0, 1):
        meta = ScannerExecutionMetadata(
            scanner=SCANNER_NAME,
            status="failed",
            duration_ms=duration_ms,
            findings_count=0,
            error_message=f"pip-audit failed with exit code {res.returncode}: {res.stderr[:300]}",
        )
        return [], meta

    findings: List[NormalizedFinding] = []
    try:
        # pip-audit may print "Found X known vulnerabilities..." before the json
        json_start = res.stdout.find("{")
        json_end = res.stdout.rfind("}")
        if json_start != -1 and json_end != -1:
            data = json.loads(res.stdout[json_start : json_end + 1])
        else:
            data = {}

        deps = data.get("dependencies", [])
        for dep in deps:
            pkg_name = dep.get("name", "unknown")
            pkg_ver = dep.get("version", "")
            vulns = dep.get("vulns", [])

            for v in vulns:
                vuln_id = v.get("id", "VULN")
                aliases = v.get("aliases", [])
                advisory_id = aliases[0] if aliases else vuln_id
                desc = v.get("description", f"Vulnerability detected in {pkg_name}")
                fix_versions = v.get("fix_versions", [])

                remediation = f"Upgrade {pkg_name} to version {', '.join(fix_versions)}." if fix_versions else f"Review security advisory {advisory_id} for {pkg_name}."

                finding_id = f"find-pip-{pkg_name}-{advisory_id.lower()}"
                finding = NormalizedFinding(
                    id=finding_id,
                    scanner=SCANNER_NAME,
                    rule_id=advisory_id,
                    category="dependency",
                    severity="high",  # pip-audit defaults CVEs to high risk
                    title=f"Vulnerability in {pkg_name} ({pkg_ver}): {advisory_id}",
                    explanation=desc[:400],
                    file_path=requirements_file or "backend/requirements.txt",
                    remediation=remediation,
                    confidence="confirmed",
                    package_name=pkg_name,
                    advisory_id=advisory_id,
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
            error_message=f"Failed to parse pip-audit JSON output: {e}",
        )
        return [], meta
