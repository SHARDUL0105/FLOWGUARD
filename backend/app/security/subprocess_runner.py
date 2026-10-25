"""Safe subprocess execution helper for security scanners.
Enforces execution timeouts, bounded stdout/stderr buffers, argument lists (no shell=True),
restricted environment variables (sensitive credentials stripped), and controlled working directories.
"""
from __future__ import annotations

import os
import subprocess
import time
from typing import Dict, List, Optional


SENSITIVE_ENV_VARS = {
    "MONGODB_URI",
    "AUTH_SECRET_KEY",
    "SECRET_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "GITHUB_TOKEN",
    "SLACK_WEBHOOK_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "DATABASE_URL",
}


class SafeProcessResult:
    """Encapsulates execution result from a safely executed subprocess."""

    def __init__(
        self,
        returncode: int,
        stdout: str,
        stderr: str,
        timed_out: bool = False,
        error_message: Optional[str] = None,
        duration_ms: float = 0.0,
    ) -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
        self.timed_out = timed_out
        self.error_message = error_message
        self.duration_ms = duration_ms

    @property
    def success(self) -> bool:
        return self.returncode == 0 and not self.timed_out


def build_restricted_env(extra_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Create a minimal, sanitized environment dictionary stripped of all production credentials."""
    safe_env: Dict[str, str] = {}
    for k, v in os.environ.items():
        if k.upper() not in SENSITIVE_ENV_VARS and not any(term in k.upper() for term in ("SECRET", "PASSWORD", "KEY")):
            safe_env[k] = v

    # Add safe defaults
    safe_env["PYTHONDONTWRITEBYTECODE"] = "1"
    safe_env["PYTHONUNBUFFERED"] = "1"
    safe_env["NODE_OPTIONS"] = ""  # Prevent inspector attachment or arbitrary flags

    if extra_env:
        safe_env.update(extra_env)

    return safe_env


def run_command_safely(
    args: List[str],
    cwd: Optional[str] = None,
    timeout: float = 15.0,
    max_output_bytes: int = 2 * 1024 * 1024,
    extra_env: Optional[Dict[str, str]] = None,
) -> SafeProcessResult:
    """Execute an external command safely using an argument list and bounded buffers.

    Args:
        args: List of command arguments. Must not be a shell string.
        cwd: Controlled working directory path.
        timeout: Maximum duration in seconds before terminating process.
        max_output_bytes: Maximum allowed output bytes to prevent DoS.
        extra_env: Additional safe environment variables.

    Returns:
        SafeProcessResult containing execution diagnostics.
    """
    if not args or not isinstance(args, list):
        return SafeProcessResult(
            returncode=-1,
            stdout="",
            stderr="Invalid argument list",
            error_message="args must be a non-empty list of strings",
        )

    clean_env = build_restricted_env(extra_env)
    t0 = time.perf_counter()

    try:
        proc = subprocess.Popen(
            args,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=cwd,
            env=clean_env,
            shell=False,  # strictly prohibited
        )

        try:
            raw_out, raw_err = proc.communicate(timeout=timeout)
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)

            # Cap output to max_output_bytes
            stdout = raw_out[:max_output_bytes].decode("utf-8", errors="replace")
            stderr = raw_err[:max_output_bytes].decode("utf-8", errors="replace")

            return SafeProcessResult(
                returncode=proc.returncode,
                stdout=stdout,
                stderr=stderr,
                timed_out=False,
                duration_ms=duration_ms,
            )

        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.communicate(timeout=1.0)
            except Exception:
                pass
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)
            return SafeProcessResult(
                returncode=-1,
                stdout="",
                stderr=f"Process exceeded execution timeout of {timeout}s",
                timed_out=True,
                error_message=f"Execution timed out after {timeout}s",
                duration_ms=duration_ms,
            )

    except FileNotFoundError as e:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        return SafeProcessResult(
            returncode=-1,
            stdout="",
            stderr=str(e),
            error_message=f"Executable '{args[0]}' not found: {e}",
            duration_ms=duration_ms,
        )
    except Exception as e:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        return SafeProcessResult(
            returncode=-1,
            stdout="",
            stderr=str(e),
            error_message=f"Process execution error: {e}",
            duration_ms=duration_ms,
        )
