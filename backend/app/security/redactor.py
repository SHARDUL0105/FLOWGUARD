"""Secret redaction utilities to prevent credential leaks across UI, logs, API responses, and storage."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Union

# Common high-risk credential patterns
_AWS_ACCESS_KEY_RE = re.compile(r"\b(AKIA[0-9A-Z]{16})\b")
_AWS_SECRET_KEY_RE = re.compile(r"(?i)\b(aws_secret_access_key|aws_secret|secret_key)\s*[:=]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?")
_STRIPE_KEY_RE = re.compile(r"\b(sk_live_[0-9a-zA-Z]{24,34}|rk_live_[0-9a-zA-Z]{24,34})\b")
_GITHUB_TOKEN_RE = re.compile(r"\b(ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})\b")
_SLACK_TOKEN_RE = re.compile(r"\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b")
_PRIVATE_KEY_RE = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----")
_MONGO_URI_PWD_RE = re.compile(r"(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)")
_GENERIC_CRED_RE = re.compile(r"(?i)(password|passwd|secret|api_key|apikey|auth_token|bearer)\s*[:=]\s*['\"]?([^'\"\s\r\n]{6,})['\"]?")


def mask_secret(secret: str, prefix_len: int = 4, suffix_len: int = 2) -> str:
    """Mask a secret string preserving only a short prefix and suffix for reference."""
    if not secret:
        return ""
    if len(secret) <= prefix_len + suffix_len:
        return "*" * len(secret)
    return secret[:prefix_len] + ("*" * (len(secret) - prefix_len - suffix_len)) + secret[-suffix_len:]


def redact_text(text: str) -> str:
    """Redact all known sensitive credentials and tokens from a text string."""
    if not text or not isinstance(text, str):
        return text

    # Redact private keys
    text = _PRIVATE_KEY_RE.sub("-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY]\n-----END PRIVATE KEY-----", text)

    # Redact MongoDB URIs passwords
    text = _MONGO_URI_PWD_RE.sub(r"\1[REDACTED_PASSWORD]\3", text)

    # Redact AWS access keys
    text = _AWS_ACCESS_KEY_RE.sub(lambda m: mask_secret(m.group(1), 4, 2), text)

    # Redact AWS secret keys
    text = _AWS_SECRET_KEY_RE.sub(r"\1: [REDACTED_AWS_SECRET]", text)

    # Redact Stripe live keys
    text = _STRIPE_KEY_RE.sub(lambda m: mask_secret(m.group(1), 8, 2), text)

    # Redact GitHub tokens
    text = _GITHUB_TOKEN_RE.sub(lambda m: mask_secret(m.group(1), 4, 2), text)

    # Redact Slack tokens
    text = _SLACK_TOKEN_RE.sub(lambda m: mask_secret(m.group(1), 5, 2), text)

    # Redact generic config/code secrets
    def _cred_sub(m: re.Match) -> str:
        key_name = m.group(1)
        val = m.group(2)
        # Avoid redacting simple placeholders
        if val.lower() in ("true", "false", "null", "none", "password", "secret", "undefined", "[redacted]"):
            return m.group(0)
        return f"{key_name}: [REDACTED]"

    text = _GENERIC_CRED_RE.sub(_cred_sub, text)
    return text


def redact_data(obj: Any) -> Any:
    """Recursively redact dictionary, list, or string data structures."""
    if isinstance(obj, str):
        return redact_text(obj)
    elif isinstance(obj, dict):
        new_dict: Dict[str, Any] = {}
        for k, v in obj.items():
            if any(term in k.lower() for term in ("password", "secret", "private_key", "token", "api_key")):
                new_dict[k] = "[REDACTED]"
            else:
                new_dict[k] = redact_data(v)
        return new_dict
    elif isinstance(obj, list):
        return [redact_data(item) for item in obj]
    return obj
