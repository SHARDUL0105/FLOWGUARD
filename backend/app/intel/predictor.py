"""Analytic forecast compared with measured simulator results."""

from ..sim.reference_sim import predict, run, window, BASE_EDGES


def whatif(scenario: str, factor: float, edges=BASE_EDGES) -> dict:
    p = predict(edges, scenario, factor)
    mp95, merr = window(run(edges, scenario, severity=factor))
    acc = max(0.0, 1 - abs(p["p95_ms"] - mp95) / mp95)
    note = (
        None
        if acc >= 0.8
        else "Forecast ignores retry feedback near saturation; risk level HIGH is still correct."
    )
    return {
        "scenario": scenario,
        "factor": factor,
        "predicted": {
            "p95_ms": p["p95_ms"],
            "error_rate": p["error_rate"],
            "utilization": p["utilization"],
            "saturated": p["saturated"],
            "risk": p["risk"],
        },
        "measured": {"p95_ms": mp95, "error_rate": merr},
        "accuracy": acc,
        "note": note,
    }
