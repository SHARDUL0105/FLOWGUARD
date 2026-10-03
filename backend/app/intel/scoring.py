"""Owner: Sneha. Resilience score 0-100. Works now by wrapping the reference sim."""
from ..sim.reference_sim import score as _score, BASE_EDGES

def resilience_score(edges=BASE_EDGES, verbose=False) -> int:
    return _score(edges, verbose=verbose)
