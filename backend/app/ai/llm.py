"""Owner: Vaishnavi. Provider-agnostic streaming wrapper. Env: LLM_API_KEY, LLM_MODEL, LLM_BASE_URL. 6s timeout."""
class LLMUnavailable(Exception): ...
async def complete_stream(system: str, user: str):
    raise LLMUnavailable("TODO Vaishnavi")
    yield ""
