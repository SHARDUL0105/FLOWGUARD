"""Resilience score (0-100), Section 7 of the brief.

Runs the three default fault scenarios headless against a config and compares each
with a common no-fault baseline. The score is derived from simulator results only.
"""

from ..sim.reference_sim import BASE_EDGES, SEVERITY, run, window

SCENARIOS = ("db_latency", "service_down", "traffic_spike")


def scenario_penalty(p95: float, error_rate: float, baseline_p95: float) -> float:
    """0.6 * error penalty + 0.4 * latency penalty, each clipped to [0, 1]."""
    err_pen = min(1.0, error_rate / 0.5)
    lat_pen = min(1.0, max(0.0, p95 / baseline_p95 - 1) / 3)
    return 0.6 * err_pen + 0.4 * lat_pen


def resilience_score(edges=BASE_EDGES, base=None, verbose: bool = False) -> int:
    """Return round(100 * (1 - mean scenario penalty)).

    edges: edge config to test (defaults to the base config).
    base:  optional precomputed (p95, error_rate) no-fault baseline, same window.
    verbose: print per-scenario numbers (off by default).
    """
    baseline_p95, _ = base or window(run(edges, None))
    penalties = []
    for sc in SCENARIOS:
        p95, err = window(run(edges, sc, severity=SEVERITY[sc]))
        pen = scenario_penalty(p95, err, baseline_p95)
        penalties.append(pen)
        if verbose:
            print(f"{sc}: p95={round(p95)} ms, error_rate={round(err, 3)}, penalty={round(pen, 3)}")
    return round(100 * (1 - sum(penalties) / len(penalties)))
