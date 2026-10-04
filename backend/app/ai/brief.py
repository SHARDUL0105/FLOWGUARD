from __future__ import annotations
import json
from .llm import complete_stream, LLMUnavailable
from .guardrails import verify

SYSTEM="""You are FLOWGUARD's Incident Commander, an SRE assistant. You receive EVIDENCE as JSON.\nWrite a concise incident brief for an engineer. Rules:\n- Use ONLY facts and numbers present in the EVIDENCE. Never invent metrics or services.\n- Root cause must be described as a confidence estimate, not certainty.\n- Exactly 4 sections with these bold headings: What happened, Likely origin, Blast radius, Recommended actions.\n- Recommended actions: at most 3 bullets, concrete and ordered by priority.\n- Maximum 140 words. Plain language. No markdown other than the bold headings and bullets."""

def template(e):
    root=e.get("root_cause",[]); top=root[0] if root else {"node":"unknown","confidence":0}
    path=" -> ".join(e.get("propagation_path",[])) or "none"
    br=e.get("blast_radius",{})
    return (f"**What happened**\nA {e.get('scenario')} fault at severity {e.get('severity')} caused checkout p95 to reach {e.get('p95_ms')} ms with error rate {e.get('error_rate')}.\n\n"
            f"**Likely origin**\nThe highest confidence estimate is {top['node']} at {top['confidence']}.\n\n"
            f"**Blast radius**\nPropagation path: {path}. {br.get('total',0)} services are affected; checkout at risk is {br.get('checkout_at_risk')}.\n\n"
            f"**Recommended actions**\n- Inspect the highest-confidence origin first.\n- Bound dependency latency with effective timeouts.\n- Validate resilience across the three modeled faults.")

async def stream_brief(evidence):
    user=json.dumps(evidence,separators=(",",":"))
    try:
        chunks=[]
        async for chunk in complete_stream(SYSTEM,user): chunks.append(chunk)
        text="".join(chunks)
        if text and verify(text,evidence): source="llm"
        else: text=template(evidence); source="template"
    except LLMUnavailable:
        text=template(evidence); source="template"
    # The API layer streams this text at a controlled rate.
    return text,source
