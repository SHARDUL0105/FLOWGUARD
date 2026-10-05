"""Owner: Vaishnavi. Provider-agnostic streaming LLM wrapper.
Reads configuration from environment:
- LLM_API_KEY
- LLM_MODEL
- LLM_BASE_URL (defaults to standard OpenAI-compatible endpoint)

Uses a 6-second timeout.
If missing configuration or request fails, raises LLMUnavailable so the caller
can fall back to deterministic template generation.
"""
from __future__ import annotations

import json
import os
from typing import AsyncIterator

import httpx


class LLMUnavailable(Exception):
    """Raised when the LLM service is unconfigured, unreachable, times out, or fails."""
    pass


async def complete_stream(system: str, user: str) -> AsyncIterator[str]:
    """Stream completion tokens from an OpenAI-compatible LLM endpoint.

    Args:
        system: System prompt string.
        user: User message content (e.g. structured evidence JSON string).

    Yields:
        Text chunks as they arrive from the stream.

    Raises:
        LLMUnavailable: If configuration is missing, network fails, or timeout (6s) triggers.
    """
    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        raise LLMUnavailable("LLM_API_KEY is not configured in environment")

    model = os.getenv("LLM_MODEL", "").strip() or "gpt-4o-mini"
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip()
    if not base_url:
        base_url = "https://api.openai.com/v1"

    if base_url.endswith("/chat/completions"):
        endpoint = base_url
    else:
        endpoint = f"{base_url.rstrip('/')}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": True,
        "temperature": 0.2,
    }

    # 6.0 second total timeout
    timeout = httpx.Timeout(6.0, connect=3.0, read=6.0, write=3.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise LLMUnavailable(
                        f"LLM API returned status {response.status_code}: {error_text.decode('utf-8', errors='replace')}"
                    )

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
    except LLMUnavailable:
        raise
    except httpx.TimeoutException as e:
        raise LLMUnavailable(f"LLM request timed out after 6 seconds: {e}") from e
    except httpx.HTTPError as e:
        raise LLMUnavailable(f"LLM HTTP connection error: {e}") from e
    except Exception as e:
        raise LLMUnavailable(f"LLM call failed unexpectedly: {e}") from e
