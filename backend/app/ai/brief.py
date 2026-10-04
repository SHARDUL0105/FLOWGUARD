"""Owner: Vaishnavi. AI incident brief generation and fallback chain.
Explains structured evidence for the Incident Commander without inventing numbers.
Fallback chain:
1. LLM stream (via app.ai.llm.complete_stream)
2. Deterministic template brief built with f-strings from evidence
3. fixtures/brief.sample.md
"""
from __future__ import annotations

import asyncio
import json
import os
import pathlib
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from .llm import LLMUnavailable, complete_stream

# Resolve filesystem paths
AI_DIR = pathlib.Path(__file__).resolve().parent
PROMPT_FILE = AI_DIR / "prompts" / "incident_brief.md"
FIXTURE_FILE = AI_DIR.parents[2] / "fixtures" / "brief.sample.md"

DEFAULT_SYSTEM_PROMPT = """You are FLOWGUARD's Incident Commander, an SRE assistant. You receive EVIDENCE as JSON.
Write a concise incident brief for an engineer. Rules:
- Use ONLY facts and numbers present in the EVIDENCE. Never invent metrics or services.
- Root cause must be described as a confidence estimate, not certainty.
- Exactly 4 sections with these bold headings: What happened, Likely origin,
  Blast radius, Recommended actions.
- Recommended actions: at most 3 bullets, concrete and ordered by priority.
- Maximum 140 words. Plain language. No markdown other than the bold headings and bullets."""


def get_system_prompt() -> str:
    """Load the incident brief system prompt from file or fallback to default."""
    try:
        if PROMPT_FILE.exists():
            return PROMPT_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return DEFAULT_SYSTEM_PROMPT


def load_fixture_brief() -> str:
    """Read the canned fallback brief from fixtures/brief.sample.md."""
    try:
        if FIXTURE_FILE.exists():
            return FIXTURE_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return (
        "**What happened**\n"
        "Database latency rose first, then Inventory and Payment, then Order and Gateway.\n\n"
        "**Likely origin**\n"
        "Database (confidence estimate: high) - it degraded first and 4 upstream services followed.\n\n"
        "**Blast radius**\n"
        "5 services affected; checkout is at risk.\n\n"
        "**Recommended actions**\n"
        "- Check database saturation and slow queries.\n"
        "- Keep circuit breakers on Order -> Inventory/Payment.\n"
        "- Reduce retries during the incident."
    )


def build_evidence(
    scenario: Optional[str] = "db_latency",
    severity: Optional[float] = None,
    pr_id: Optional[Any] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Construct structured evidence dictionary for incident brief generation."""
    evidence: Dict[str, Any] = {
        "scenario": scenario or "db_latency",
        "severity": severity if severity is not None else 3.0,
    }

    sc = evidence["scenario"]
    if sc == "db_latency":
        evidence.update({
            "severity": severity if severity is not None else 3.0,
            "first_anomaly": {"database": 10, "inventory": 11, "payment": 11, "order": 12, "gateway": 13, "frontend": 14},
            "propagation_path": ["database", "inventory", "order", "gateway", "frontend"],
            "root_cause": [
                {
                    "node": "database",
                    "confidence": 0.71,
                    "evidence": ["latency rose first (tick 10)", "4 upstream services degraded after it"],
                }
            ],
            "blast_radius": {
                "direct": ["inventory", "payment"],
                "downstream": ["order", "gateway", "frontend"],
                "total": 5,
                "checkout_at_risk": True,
            },
            "checkout": {"p95_ms": 628, "error_rate": 0.004},
            "checkout_before": {"p95_ms": 468, "error_rate": 0.0},
        })
    elif sc == "service_down":
        evidence.update({
            "severity": severity if severity is not None else 1.0,
            "first_anomaly": {"inventory": 10, "order": 11, "gateway": 12, "frontend": 13},
            "propagation_path": ["inventory", "order", "gateway", "frontend"],
            "root_cause": [
                {
                    "node": "inventory",
                    "confidence": 0.88,
                    "evidence": ["returned errors starting at tick 10", "upstream calls to inventory failed"],
                }
            ],
            "blast_radius": {
                "direct": ["order"],
                "downstream": ["gateway", "frontend"],
                "total": 3,
                "checkout_at_risk": True,
            },
            "checkout": {"p95_ms": 369, "error_rate": 0.0},
            "checkout_before": {"p95_ms": 468, "error_rate": 0.0},
        })
    elif sc == "traffic_spike":
        evidence.update({
            "severity": severity if severity is not None else 2.0,
            "first_anomaly": {"payment": 10, "order": 11, "gateway": 12, "frontend": 13},
            "propagation_path": ["payment", "order", "gateway", "frontend"],
            "root_cause": [
                {
                    "node": "payment",
                    "confidence": 0.65,
                    "evidence": ["utilization crossed 95% at tick 10", "queue saturation propagated upstream"],
                }
            ],
            "blast_radius": {
                "direct": ["order"],
                "downstream": ["gateway", "frontend"],
                "total": 3,
                "checkout_at_risk": True,
            },
            "checkout": {"p95_ms": 2018, "error_rate": 0.028},
            "checkout_before": {"p95_ms": 468, "error_rate": 0.0},
        })

    if pr_id is not None:
        evidence["pr_id"] = int(pr_id) if str(pr_id).isdigit() else pr_id
        if str(pr_id) in ("12", "pr12", "pr-12"):
            evidence.update({
                "scenario": scenario or "db_latency",
                "pr_title": "Refactor inventory client",
                "propagation_path": ["database", "inventory", "order", "gateway", "frontend"],
                "root_cause": [
                    {
                        "node": "database",
                        "confidence": 0.71,
                        "evidence": ["latency rose first (tick 10)", "order -> inventory retried 4 times without timeout"],
                    }
                ],
                "blast_radius": {
                    "direct": ["inventory", "payment"],
                    "downstream": ["order", "gateway", "frontend"],
                    "total": 5,
                    "checkout_at_risk": True,
                },
                "checkout": {"p95_ms": 3000, "error_rate": 0.93},
                "checkout_before": {"p95_ms": 468, "error_rate": 0.0},
            })

    # Merge any explicit overrides passed in kwargs
    evidence.update(kwargs)
    return evidence


def generate_template_brief(evidence: Dict[str, Any]) -> str:
    """Deterministic f-string template brief built strictly from structured evidence."""
    # 1. What happened
    path = evidence.get("propagation_path", [])
    path_str = " -> ".join(n.capitalize() for n in path) if path else "dependent services"
    checkout = evidence.get("checkout", {})
    p95 = checkout.get("p95_ms", 468)
    err = checkout.get("error_rate", 0.0)

    if "pr_title" in evidence:
        what_happened = (
            f"Under pull request #{evidence.get('pr_id', '')} ({evidence['pr_title']}), "
            f"degradation propagated along {path_str}. "
            f"Checkout p95 latency reached {p95} ms with {err * 100:.1f}% request errors."
        )
    else:
        what_happened = (
            f"Degradation propagated along {path_str}. "
            f"Checkout p95 latency reached {p95} ms with {err * 100:.1f}% request errors."
        )

    # 2. Likely origin
    root_causes = evidence.get("root_cause", [])
    if root_causes:
        top = root_causes[0]
        node_name = top.get("node", "database").capitalize()
        conf = top.get("confidence", 0.70)
        conf_str = f"{int(conf * 100)}%" if isinstance(conf, float) else str(conf)
        ev_items = top.get("evidence", [])
        ev_str = f" Evidence indicates {'; '.join(ev_items)}." if ev_items else ""
        likely_origin = f"{node_name} (confidence estimate: {conf_str}).{ev_str}"
    else:
        likely_origin = "Unknown component (confidence estimate: low). Anomaly origin not isolated."

    # 3. Blast radius
    blast = evidence.get("blast_radius", {})
    total = blast.get("total", len(path) if path else 1)
    checkout_risk = blast.get("checkout_at_risk", False)
    risk_str = "Checkout flow is at risk." if checkout_risk else "Checkout flow remains operational."
    direct = blast.get("direct", [])
    direct_str = f" Direct callers affected: {', '.join(d.capitalize() for d in direct)}." if direct else ""
    blast_radius = f"{total} services affected.{direct_str} {risk_str}"

    # 4. Recommended actions (maximum 3 bullets)
    actions: List[str] = []
    if root_causes:
        top_name = root_causes[0].get("node", "database").capitalize()
        actions.append(f"Inspect {top_name} capacity, slow queries, and active connection saturation.")
    else:
        actions.append("Inspect degraded service telemetry and error logs.")

    if checkout_risk:
        actions.append("Ensure circuit breakers and fallback queues on Order service are enabled.")
    else:
        actions.append("Monitor upstream service error rates and latency trends.")

    actions.append("Throttle non-critical background traffic and hold pending deployments.")
    actions_str = "\n".join(f"- {a}" for a in actions[:3])

    return (
        f"**What happened**\n{what_happened}\n\n"
        f"**Likely origin**\n{likely_origin}\n\n"
        f"**Blast radius**\n{blast_radius}\n\n"
        f"**Recommended actions**\n{actions_str}"
    )


async def get_brief_text_and_source(evidence: Dict[str, Any]) -> Tuple[str, str]:
    """Execute the fallback chain to retrieve the full brief text and source.
    Chain:
    1. LLM completion (if configured and valid)
    2. Deterministic template built from evidence
    3. fixtures/brief.sample.md
    """
    # Tier 1: LLM
    try:
        sys_prompt = get_system_prompt()
        user_prompt = json.dumps(evidence)
        chunks: List[str] = []
        async for chunk in complete_stream(sys_prompt, user_prompt):
            chunks.append(chunk)

        full_text = "".join(chunks).strip()
        if full_text:
            # Check guardrail if available
            try:
                from .guardrails import numbers_grounded
                if numbers_grounded(full_text, evidence):
                    return full_text, "llm"
            except Exception:
                # If guardrail check not ready or fails, fallback to template
                pass
    except (LLMUnavailable, Exception):
        pass

    # Tier 2: Deterministic template
    try:
        template_text = generate_template_brief(evidence)
        if template_text.strip():
            return template_text, "template"
    except Exception:
        pass

    # Tier 3: Fixture fallback
    return load_fixture_brief(), "fixture"


async def stream_brief(
    evidence: Dict[str, Any],
    stream_delay: float = 0.0,
) -> AsyncIterator[str]:
    """Stream incident brief chunks following the fallback chain.
    Yields string text chunks.
    """
    full_text, _ = await get_brief_text_and_source(evidence)

    # Stream by small chunks (words or slices)
    words = full_text.split(" ")
    for i, word in enumerate(words):
        chunk = word if i == len(words) - 1 else word + " "
        yield chunk
        if stream_delay > 0:
            await asyncio.sleep(stream_delay)


async def stream_brief_events(
    evidence: Dict[str, Any],
    stream_delay: float = 0.0,
) -> AsyncIterator[Dict[str, Any]]:
    """Stream SSE event objects matching Section 10 API contract.
    Yields:
      {"chunk": str} repeated,
      then {"done": True, "source": "llm" | "template" | "fixture"}
    """
    full_text, source = await get_brief_text_and_source(evidence)

    words = full_text.split(" ")
    for i, word in enumerate(words):
        chunk = word if i == len(words) - 1 else word + " "
        yield {"chunk": chunk}
        if stream_delay > 0:
            await asyncio.sleep(stream_delay)

    yield {"done": True, "source": source}
