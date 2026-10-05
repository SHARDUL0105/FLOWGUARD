from copy import deepcopy

import pytest

from app.intel.scoring import resilience_score
from app.sim.reference_sim import BASE_EDGES, SEVERITY, run, window


SCORING_SCENARIOS = (
    ("db_latency", 3.0),
    ("service_down", 1.0),
    ("traffic_spike", 2.0),
)


def _score_from_simulator_results(edges):
    baseline_p95, _ = window(run(edges, None))
    penalties = []
    for scenario, severity in SCORING_SCENARIOS:
        p95, error_rate = window(run(edges, scenario, severity=severity))
        error_penalty = min(1.0, error_rate / 0.5)
        latency_penalty = min(
            1.0,
            max(0.0, p95 / baseline_p95 - 1) / 3,
        )
        penalties.append(0.6 * error_penalty + 0.4 * latency_penalty)
    return round(100 * (1 - sum(penalties) / len(penalties)))


def test_default_score_is_approximately_84():
    assert resilience_score() == pytest.approx(84, abs=2)


def test_score_is_derived_from_simulator_scenarios_not_a_constant():
    changed_edges = deepcopy(BASE_EDGES)
    changed_edges[("order", "inventory")].update(
        timeout=None,
        retries=4,
        fallback=False,
        breaker=False,
    )

    assert resilience_score(changed_edges) == _score_from_simulator_results(changed_edges)
    assert resilience_score(changed_edges) != resilience_score(BASE_EDGES)


def test_required_scenario_penalties_use_brief_formula_and_common_baseline():
    assert tuple(SEVERITY[scenario] for scenario, _ in SCORING_SCENARIOS) == tuple(
        severity for _, severity in SCORING_SCENARIOS
    )

    baseline_p95, _ = window(run(BASE_EDGES, None))
    scenario_penalties = []
    for scenario, severity in SCORING_SCENARIOS:
        p95, error_rate = window(run(BASE_EDGES, scenario, severity=severity))
        err_pen = min(1.0, error_rate / 0.5)
        lat_pen = min(1.0, max(0.0, p95 / baseline_p95 - 1) / 3)
        scenario_penalties.append(0.6 * err_pen + 0.4 * lat_pen)

    expected = round(
        100 * (1 - sum(scenario_penalties) / len(SCORING_SCENARIOS))
    )
    assert resilience_score(BASE_EDGES) == expected


def test_repeated_calls_are_deterministic():
    assert resilience_score(BASE_EDGES) == resilience_score(BASE_EDGES)


def test_public_contract_keeps_custom_edges_and_verbose_behavior(capsys):
    assert isinstance(resilience_score(BASE_EDGES), int)
    assert capsys.readouterr().out == ""

    score = resilience_score(BASE_EDGES, verbose=True)
    output = capsys.readouterr().out
    assert isinstance(score, int)
    assert output.strip()
