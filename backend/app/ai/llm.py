from __future__ import annotations
import os, httpx

class LLMUnavailable(Exception): pass

async def complete_stream(system: str, user: str):
    key=os.getenv("LLM_API_KEY")
    base=os.getenv("LLM_BASE_URL","").rstrip("/")
    model=os.getenv("LLM_MODEL","")
    if not key or not base or not model: raise LLMUnavailable("LLM configuration missing")
    # Provider-agnostic OpenAI-compatible streaming wrapper.
    url=base+"/chat/completions"
    payload={"model":model,"messages":[{"role":"system","content":system},{"role":"user","content":user}],"stream":True}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            async with client.stream("POST",url,headers={"Authorization":f"Bearer {key}","Content-Type":"application/json"},json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if line.startswith("data: ") and line[6:] != "[DONE]":
                        import json
                        try:
                            obj=json.loads(line[6:]); delta=obj.get("choices",[{}])[0].get("delta",{}).get("content")
                            if delta: yield delta
                        except Exception: continue
    except Exception as exc:
        raise LLMUnavailable(str(exc)) from exc
