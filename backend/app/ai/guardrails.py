"""Owner: Vaishnavi. Deterministic numeric verification guardrail for AI incident briefs.
Verifies that every numeric value present in the generated text is grounded in the structured
evidence JSON within an allowed rounding tolerance of +/- 1.
If any number in the text cannot be supported by the evidence, the text is rejected.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Set


def extract_numbers_from_text(text: str) -> List[float]:
    """Extract all non-negative numeric values (integers and floats) from text."""
    numbers: List[float] = []
    # Match standalone numbers and percentages (e.g. 628, 0.4%, 71%, 10)
    for match in re.finditer(r"(?<![A-Za-z0-9_])(\d+(?:\.\d+)?)", text):
        num_str = match.group(1)
        try:
            numbers.append(float(num_str))
        except ValueError:
            pass
    return numbers


def extract_numbers_from_evidence(evidence: Any) -> Set[float]:
    """Recursively extract all numeric values from structured evidence JSON/dict.
    For ratios in (0.0, 1.0], also adds percentage representations (e.g. 0.71 -> 71.0).
    """
    numbers: Set[float] = set()

    def _walk(obj: Any) -> None:
        if isinstance(obj, (int, float)) and not isinstance(obj, bool):
            val = float(obj)
            numbers.add(round(val, 4))
            # Ratios like error_rate (0.004) or confidence (0.71) can appear as percentages (0.4%, 71%)
            if 0.0 < val <= 1.0:
                numbers.add(round(val * 100.0, 4))
        elif isinstance(obj, str):
            for match in re.finditer(r"(?<![A-Za-z0-9_])(\d+(?:\.\d+)?)", obj):
                try:
                    n = float(match.group(1))
                    numbers.add(round(n, 4))
                    if 0.0 < n <= 1.0:
                        numbers.add(round(n * 100.0, 4))
                except ValueError:
                    pass
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _walk(k)
                _walk(v)
        elif isinstance(obj, (list, tuple, set)):
            for item in obj:
                _walk(item)

    _walk(evidence)
    return numbers


def numbers_grounded(text: str, evidence: Dict[str, Any], tolerance: float = 1.0) -> bool:
    """Verify that every numeric value in `text` exists in `evidence` within `tolerance`.

    Args:
        text: Generated LLM text to verify.
        evidence: Structured evidence dictionary.
        tolerance: Allowed rounding margin (default +/- 1.0).

    Returns:
        True if all numbers in the text are supported by the evidence within tolerance;
        False if any number is ungrounded/invented, or if text is empty.
    """
    if not text or not text.strip():
        return False

    text_numbers = extract_numbers_from_text(text)
    if not text_numbers:
        # If no numbers were cited, no hallucinated numbers exist
        return True

    evidence_numbers = extract_numbers_from_evidence(evidence)
    if not evidence_numbers:
        # Text has numbers but evidence has none
        return False

    for num in text_numbers:
        # Check if `num` is within `tolerance` of ANY number in `evidence_numbers`
        matched = any(abs(num - ev_num) <= (tolerance + 1e-6) for ev_num in evidence_numbers)
        if not matched:
            return False

    return True


def validate_or_fallback(text: str, evidence: Dict[str, Any], fallback_text: str) -> str:
    """Convenience helper returning `text` if numbers are grounded, else `fallback_text`."""
    if numbers_grounded(text, evidence):
        return text
    return fallback_text
