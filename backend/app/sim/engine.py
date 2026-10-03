"""Owner: Abhiraj. Thin wrapper over reference_sim.py. Refactor into topology/config/faults later,
but numbers must keep matching Appendix B (base score 84, PR12 32)."""
from .reference_sim import (BASE_EDGES, SCENARIOS, SEVERITY, run, window, score, predict)

def headless(edges=BASE_EDGES, fault=None, severity=3.0, ticks=60, record=False):
    return run(edges, fault, ticks=ticks, severity=severity, record=record)

def baseline(edges=BASE_EDGES):
    return window(run(edges, None))
