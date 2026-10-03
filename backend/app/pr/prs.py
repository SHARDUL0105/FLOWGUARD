"""Owner: Vaishnavi. Demo PRs: 12 (risky), 13 (safe). PR 12 changes edge order->inventory:
timeout_ms null, retries 4, breaker false, fallback false."""
import copy
from ..sim.reference_sim import BASE_EDGES

def pr_edges(pr_id: int) -> dict:
    e = copy.deepcopy(BASE_EDGES)
    if pr_id == 12:
        e[("order", "inventory")].update(timeout=None, retries=4, fallback=False, breaker=False)
    return e
