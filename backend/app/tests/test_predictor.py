from copy import deepcopy

import pytest

from app.intel.predictor import predict, whatif
from app.sim import reference_sim
from app.sim.reference_sim import BASE_EDGES, run, window


def test_analytic_forecast_output_contract():
    result = predict(BASE_EDGES, "db_latency", 2.0)

    assert set(result) == {
        "p95_ms",
        "error_rate",
        "utilization",
        "saturated",
        "risk",
    }
    assert result["p95_ms"] > 0
    assert 0 <= result["error_rate"] <= 1
    assert isinstance(result["utilization"], dict)
    assert all(isinstance(value, float) for value in result["utilization"].values())
    assert isinstance(result["saturated"], list)
    assert result["risk"] in {"LOW", "MEDIUM", "HIGH"}


@pytest.mark.parametrize(
    ("target_utilization", "expected_risk"),
    [(0.79, "LOW"), (0.8, "MEDIUM"), (0.949, "MEDIUM"), (0.95, "HIGH")],
)
def test_risk_thresholds(target_utilization, expected_risk, monkeypatch):
    services = deepcopy(reference_sim.SERVICES)
    for config in services.values():
        config["cap"] = 1_000_000
    services["frontend"]["cap"] = 100 / target_utilization
    monkeypatch.setattr(reference_sim, "SERVICES", services)

    result = predict(BASE_EDGES)

    assert result["utilization"]["frontend"] == pytest.approx(
        round(target_utilization, 2)
    )
    assert result["risk"] == expected_risk


def test_utilization_and_saturated_services_are_consistent():
    result = predict(BASE_EDGES, "db_latency", 3.0)

    assert result["utilization"]["database"] >= 0.95
    assert "database" in result["saturated"]
    assert all(
        result["utilization"][service] >= 0.95
        for service in result["saturated"]
    )
    assert result["risk"] == "HIGH"


def test_whatif_returns_analytic_forecast_and_measured_results():
    result = whatif("db_latency", 2.0)
    forecast = predict(BASE_EDGES, "db_latency", 2.0)
    measured_p95, measured_error = window(
        run(BASE_EDGES, "db_latency", severity=2.0)
    )

    assert result["predicted"] == {
        "p95_ms": forecast["p95_ms"],
        "error_rate": forecast["error_rate"],
        "utilization": forecast["utilization"],
        "saturated": forecast["saturated"],
        "risk": forecast["risk"],
    }
    assert result["measured"]["p95_ms"] == pytest.approx(measured_p95)
    assert result["measured"]["error_rate"] == pytest.approx(measured_error)
    assert result["scenario"] == "db_latency"
    assert result["factor"] == 2.0


def test_whatif_accuracy_uses_p95_formula():
    result = whatif("db_latency", 3.0)
    expected = max(
        0.0,
        1 - abs(result["predicted"]["p95_ms"] - result["measured"]["p95_ms"])
        / result["measured"]["p95_ms"],
    )

    assert result["accuracy"] == pytest.approx(expected)


@pytest.mark.parametrize("factor", [1.5, 2.0, 2.5])
def test_db_latency_forecast_closely_matches_measurement(factor):
    result = whatif("db_latency", factor)

    assert result["accuracy"] >= 0.95
    assert result["note"] is None
    assert result["predicted"]["p95_ms"] == pytest.approx(
        result["measured"]["p95_ms"],
        rel=0.05,
    )


def test_db_latency_three_forecast_reports_high_risk_and_exact_note():
    result = whatif("db_latency", 3.0)

    assert result["predicted"]["p95_ms"] < result["measured"]["p95_ms"]
    assert result["accuracy"] < 0.8
    assert result["predicted"]["risk"] == "HIGH"
    assert result["note"] == (
        "Forecast ignores retry feedback near saturation; risk level HIGH is still correct."
    )


def test_repeated_forecasts_and_whatif_calls_are_deterministic():
    assert predict(BASE_EDGES, "db_latency", 2.5) == predict(
        BASE_EDGES, "db_latency", 2.5
    )
    assert whatif("db_latency", 2.5) == whatif("db_latency", 2.5)
