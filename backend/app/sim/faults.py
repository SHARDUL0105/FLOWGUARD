from __future__ import annotations

SCENARIOS = {"db_latency", "service_down", "traffic_spike"}


def validate_scenario(scenario: str) -> str:
    if scenario not in SCENARIOS:
        raise ValueError(f"Unsupported scenario: {scenario}")
    return scenario


def apply_fault(scenario, severity, t, fault_at, services_order):
    mult = {s: 1.0 for s in services_order}
    down = set()
    load_mult = 1.0
    if scenario and t >= fault_at:
        if scenario == "db_latency":
            mult["database"] = severity
        elif scenario == "service_down":
            down.add("inventory")
        elif scenario == "traffic_spike":
            load_mult = severity
    return mult, down, load_mult
