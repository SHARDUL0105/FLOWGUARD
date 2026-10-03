"""Owner: Sneha. Determinism + Appendix B numbers."""
import copy
from app.sim.reference_sim import BASE_EDGES, score

def test_deterministic_base_score():
    assert score(BASE_EDGES) == score(BASE_EDGES) == 84

def test_risky_pr_drops_and_fix_recovers():
    risky = copy.deepcopy(BASE_EDGES)
    risky[("order", "inventory")].update(timeout=None, retries=4, fallback=False, breaker=False)
    assert abs(score(risky) - 32) <= 2
    fixed = copy.deepcopy(risky)
    fixed[("order", "inventory")].update(timeout=700, retries=1, fallback=True, breaker=True)
    assert abs(score(fixed) - 84) <= 2
